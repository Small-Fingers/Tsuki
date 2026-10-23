import { Router } from 'express';
import mongoose from 'mongoose';
import Property from '../models/property.model.js';
import Review from '../models/review.model.js';
import User from '../models/user.model.js';
import Chat from '../models/chat.model.js';
import Viewing from '../models/viewing.model.js';
import ViewingSlot from '../models/viewing-slot.model.js';
import ListingActivity from '../models/listing-activity.model.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { deleteImageFiles, propertyImageFilenames } from '../utils/local-images.js';
import { recordListingActivity, utcDay } from '../utils/listing-activity.js';
import { publicProperty } from '../utils/public-property.js';

const router = Router();
router.get('/', async (req, res, next) => {
  try {
    const { city, area, pincode, propertyType, bhk, furnishing, purpose, status = 'sale', minPrice, maxPrice, sort = 'latest' } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(24, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 12));
    const query = { status };
    if (purpose === 'sale') query.$or = [{ purpose: 'sale' }, { purpose: { $exists: false } }];
    if (purpose === 'rent') query.purpose = 'rent';
    const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (city) query.city = new RegExp(escapeRegex(city), 'i');
    if (area) query.area = new RegExp(escapeRegex(area), 'i');
    if (pincode) query.pincode = pincode;
    if (propertyType) query.propertyType = { $in: String(propertyType).split(',') };
    if (bhk) query.bhk = bhk === '5+' ? { $gte: '5' } : bhk;
    if (furnishing) query.furnishing = { $in: String(furnishing).split(',') };
    if (minPrice || maxPrice) query.price = { ...(minPrice ? { $gte: Number(minPrice) } : {}), ...(maxPrice ? { $lte: Number(maxPrice) } : {}) };
    const sorting = sort === 'priceLow' ? { price: 1 } : sort === 'priceHigh' ? { price: -1 } : { createdAt: -1 };
    const [total, documents] = await Promise.all([
      Property.countDocuments(query),
      Property.find(query).populate('seller', 'name phone profilePic').sort(sorting).skip((page - 1) * pageSize).limit(pageSize),
    ]);
    const propertyIds = documents.map((property) => property._id);
    const sellerIds = [...new Set(documents.map((property) => property.seller?._id?.toString()).filter(Boolean))];
    const reviewSummaries = propertyIds.length ? await Review.aggregate([
      { $match: { $or: [{ targetType: 'property', property: { $in: propertyIds } }, { targetType: 'seller', seller: { $in: sellerIds.map((id) => new mongoose.Types.ObjectId(id)) } }] } },
      { $group: { _id: { targetType: '$targetType', target: { $cond: [{ $eq: ['$targetType', 'property'] }, '$property', '$seller'] } }, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]) : [];
    const summaryByKey = new Map(reviewSummaries.map((summary) => [`${summary._id.targetType}:${summary._id.target}`, { rating: Number(summary.average.toFixed(1)), count: summary.count }]));
    const properties = documents.map((property) => ({
      ...property.toObject(),
      propertyReviewSummary: summaryByKey.get(`property:${property._id}`) || { rating: null, count: 0 },
      sellerReviewSummary: summaryByKey.get(`seller:${property.seller?._id}`) || { rating: null, count: 0 },
    })).map(publicProperty);
    res.json({ success: true, count: properties.length, total, page, pageSize, totalPages: Math.ceil(total / pageSize), properties });
  } catch (e) { next(e); }
});
router.get('/mine', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try { const properties = await Property.find(req.user.role === 'admin' ? {} : { seller: req.user._id }).sort({ createdAt: -1 }); res.json({ properties }); } catch (e) { next(e); }
});
router.get('/mine/analytics', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const days = Number(req.query.days) === 30 ? 30 : 7;
    const endDate = utcDay();
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - days);
    const properties = await Property.find({ seller: req.user._id }).select('_id views').lean();
    const propertyIds = properties.map(({ _id }) => _id);
    if (!propertyIds.length) return res.json({ summary: { views: 0, saves: 0, conversations: 0, viewings: 0, pendingViewings: 0 }, listings: [], trend: [] });

    const [savesByProperty, conversationsByProperty, viewingsByProperty, dailyActivity] = await Promise.all([
      User.aggregate([
        { $match: { savedProperties: { $in: propertyIds } } },
        { $unwind: '$savedProperties' },
        { $match: { savedProperties: { $in: propertyIds } } },
        { $group: { _id: '$savedProperties', count: { $sum: 1 } } },
      ]),
      Chat.aggregate([
        { $match: { seller: req.user._id, property: { $in: propertyIds } } },
        { $group: { _id: '$property', count: { $sum: 1 } } },
      ]),
      Viewing.aggregate([
        { $match: { seller: req.user._id, property: { $in: propertyIds } } },
        { $group: { _id: '$property', count: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } } } },
      ]),
      ListingActivity.aggregate([
        { $match: { seller: req.user._id, property: { $in: propertyIds }, date: { $gte: startDate, $lt: endDate } } },
        { $group: { _id: '$date', views: { $sum: '$views' }, saves: { $sum: '$saves' }, conversations: { $sum: '$conversations' }, viewings: { $sum: '$viewings' } } },
      ]),
    ]);
    const mapCounts = (rows) => new Map(rows.map(({ _id, count }) => [String(_id), count]));
    const saves = mapCounts(savesByProperty);
    const conversations = mapCounts(conversationsByProperty);
    const viewingCounts = new Map(viewingsByProperty.map(({ _id, count, pending }) => [String(_id), { count, pending }]));
    const listings = properties.map((property) => {
      const id = String(property._id);
      const viewing = viewingCounts.get(id) || { count: 0, pending: 0 };
      return { propertyId: id, views: property.views || 0, saves: saves.get(id) || 0, conversations: conversations.get(id) || 0, viewings: viewing.count, pendingViewings: viewing.pending };
    });
    const dailyByDate = new Map(dailyActivity.map((activity) => [utcDay(activity._id).toISOString().slice(0, 10), activity]));
    const trend = [];
    for (const date = new Date(startDate); date < endDate; date.setUTCDate(date.getUTCDate() + 1)) {
      const key = date.toISOString().slice(0, 10);
      const activity = dailyByDate.get(key);
      trend.push({ date: key, views: activity?.views || 0, saves: activity?.saves || 0, conversations: activity?.conversations || 0, viewings: activity?.viewings || 0 });
    }
    res.json({
      summary: listings.reduce((total, listing) => ({
        views: total.views + listing.views,
        saves: total.saves + listing.saves,
        conversations: total.conversations + listing.conversations,
        viewings: total.viewings + listing.viewings,
        pendingViewings: total.pendingViewings + listing.pendingViewings,
      }), { views: 0, saves: 0, conversations: 0, viewings: 0, pendingViewings: 0 }),
      listings,
      trend,
    });
  } catch (error) { next(error); }
});
router.get('/mine/:id', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Listing ID is invalid.' });
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Listing not found.' });
    if (req.user.role !== 'admin' && String(property.seller) !== String(req.user._id)) return res.status(403).json({ message: 'You can only edit your own listings.' });
    res.json({ property });
  } catch (error) { next(error); }
});
router.get('/counts', async (_req, res, next) => {
  try { const counts = await Property.aggregate([{ $match: { status: 'sale' } }, { $group: { _id: '$propertyType', count: { $sum: 1 } } }]); res.json(Object.fromEntries(counts.map(({ _id, count }) => [_id, count]))); } catch (e) { next(e); }
});
router.get('/compare', async (req, res, next) => {
  try {
    const ids = [...new Set(String(req.query.ids || '').split(',').filter(Boolean))];
    if (ids.length > 4) return res.status(400).json({ message: 'Compare up to four homes at a time.' });
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) return res.status(400).json({ message: 'One or more listing IDs are invalid.' });
    const found = await Property.find({ _id: { $in: ids } }).populate('seller', 'name').lean();
    const byId = new Map(found.map((property) => [String(property._id), property]));
    res.json({ properties: ids.map((id) => byId.get(id)).filter(Boolean).map(publicProperty) });
  } catch (e) { next(e); }
});
router.get('/sellers/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid seller ID.' });
    const seller = await User.findOne({ _id: req.params.id, role: 'seller' }).select('name profilePic createdAt');
    if (!seller) return res.status(404).json({ message: 'Seller not found.' });
    const [properties, reviews, conversations] = await Promise.all([
      Property.find({ seller: seller._id, status: 'sale' }).sort({ createdAt: -1 }).limit(100).lean(),
      Review.find({ seller: seller._id, targetType: 'seller' }).populate('reviewer', 'name profilePic').sort({ createdAt: -1 }).limit(100).lean(),
      Chat.find({ seller: seller._id, updatedAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } }).select('buyer messages.sender messages.sentAt').lean(),
    ]);
    const responses = [];
    let conversationsWithBuyerMessages = 0;
    for (const chat of conversations) {
      const messages = [...(chat.messages || [])].sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
      const firstBuyerMessage = messages.find((message) => String(message.sender) === String(chat.buyer));
      if (!firstBuyerMessage) continue;
      conversationsWithBuyerMessages += 1;
      const sellerReply = messages.find((message) => String(message.sender) === String(seller._id) && new Date(message.sentAt) > new Date(firstBuyerMessage.sentAt));
      if (sellerReply) responses.push((new Date(sellerReply.sentAt) - new Date(firstBuyerMessage.sentAt)) / 60_000);
    }
    const rating = reviews.length ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)) : null;
    res.json({
      seller: { _id: seller._id, name: seller.name, profilePic: seller.profilePic, memberSince: seller.createdAt },
      properties: properties.map(publicProperty),
      rating,
      reviewCount: reviews.length,
      reviews,
      trust: {
        activeListings: properties.length,
        reviewedListings: properties.filter((property) => property.isVerified).length,
        responseRate: conversationsWithBuyerMessages ? Math.round((responses.length / conversationsWithBuyerMessages) * 100) : null,
        responseSampleSize: conversationsWithBuyerMessages,
        averageResponseMinutes: responses.length ? Math.round(responses.reduce((sum, minutes) => sum + minutes, 0) / responses.length) : null,
      },
    });
  } catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try { const property = await Property.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true }).populate('seller', 'name phone profilePic createdAt'); if (!property) return res.status(404).json({ message: 'Listing not found' }); await recordListingActivity(property._id, property.seller._id, 'views'); res.json({ property: publicProperty(property) }); } catch (e) { next(e); }
});
router.post('/', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const editable = ['title', 'description', 'price', 'purpose', 'city', 'area', 'pincode', 'latitude', 'longitude', 'locationPrecision', 'propertyType', 'bhk', 'bathrooms', 'areaSize', 'furnishing', 'status', 'amenities', 'images'];
    const listing = Object.fromEntries(editable.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    if (listing.purpose === 'rent' && listing.status === 'sold') return res.status(400).json({ message: 'Rental listings cannot be marked as sold.' });
    if (listing.purpose !== 'rent' && listing.status === 'rented') return res.status(400).json({ message: 'Sale listings cannot be marked as rented.' });
    const imageFiles = Array.isArray(req.body.imageFiles) ? req.body.imageFiles : [];
    if ((req.body.images?.length || 0) > 8 || imageFiles.length > 8) return res.status(400).json({ message: 'A listing can have up to 8 photos.' });
    const pending = (await User.findById(req.user._id).select('+uploadedImageFiles'))?.uploadedImageFiles || [];
    if (req.user.role !== 'admin' && imageFiles.some((filename) => !pending.includes(filename))) return res.status(400).json({ message: 'One or more photos are not owned by this account.' });
    const property = await Property.create({ ...listing, seller: req.user._id, imageFiles, availabilityConfirmedAt: new Date() });
    if (imageFiles.length) await req.user.updateOne({ $pull: { uploadedImageFiles: { $in: imageFiles } } });
    res.status(201).json({ property });
  } catch (e) { next(e); }
});
router.patch('/:id', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Listing not found' });
    if (req.user.role !== 'admin' && String(property.seller) !== String(req.user._id)) return res.status(403).json({ message: 'You can only edit your own listings' });
    const previousImageFiles = propertyImageFilenames(property);
    const requestedImageFiles = Array.isArray(req.body.imageFiles) ? req.body.imageFiles : previousImageFiles;
    if ((req.body.images?.length || property.images?.length || 0) > 8 || requestedImageFiles.length > 8) return res.status(400).json({ message: 'A listing can have up to 8 photos.' });
    const pending = (await User.findById(req.user._id).select('+uploadedImageFiles'))?.uploadedImageFiles || [];
    if (req.user.role !== 'admin' && requestedImageFiles.some((filename) => !previousImageFiles.includes(filename) && !pending.includes(filename))) return res.status(400).json({ message: 'One or more photos are not owned by this account.' });
    const editable = ['title', 'description', 'price', 'purpose', 'city', 'area', 'pincode', 'latitude', 'longitude', 'locationPrecision', 'propertyType', 'bhk', 'bathrooms', 'areaSize', 'furnishing', 'status', 'amenities', 'images', 'imageFiles'];
    for (const key of editable) if (req.body[key] !== undefined) property[key] = req.body[key];
    if (req.body.status === 'sale') property.availabilityConfirmedAt = new Date();
    if (property.purpose === 'rent' && property.status === 'sold') return res.status(400).json({ message: 'Rental listings cannot be marked as sold.' });
    if (property.purpose !== 'rent' && property.status === 'rented') return res.status(400).json({ message: 'Sale listings cannot be marked as rented.' });
    await property.save();
    if (property.status !== 'sale' || property.purpose === 'rent') await ViewingSlot.deleteMany({ property: property._id, status: 'available' });
    const retainedFiles = new Set(propertyImageFilenames(property));
    const removedFiles = previousImageFiles.filter((filename) => !retainedFiles.has(filename));
    if (removedFiles.length) {
      try { await deleteImageFiles(removedFiles); }
      catch (error) { console.error('Could not remove old listing photos from disk:', error.message); }
    }
    const attachedFiles = requestedImageFiles.filter((filename) => pending.includes(filename));
    if (attachedFiles.length) await req.user.updateOne({ $pull: { uploadedImageFiles: { $in: attachedFiles } } });
    res.json({ property });
  } catch (e) { next(e); }
});
router.patch('/:id/availability', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid listing ID.' });
    const property = await Property.findOne({ _id: req.params.id, seller: req.user._id, status: 'sale' });
    if (!property) return res.status(404).json({ message: 'Choose one of your active listings.' });
    property.availabilityConfirmedAt = new Date();
    await property.save();
    res.json({ property });
  } catch (e) { next(e); }
});
router.delete('/:id', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Listing not found' });
    if (req.user.role !== 'admin' && String(property.seller) !== String(req.user._id)) return res.status(403).json({ message: 'You can only delete your own listings' });
    await property.deleteOne();
    await ViewingSlot.deleteMany({ property: property._id });
    const imageFiles = propertyImageFilenames(property);
    if (imageFiles.length) {
      try { await deleteImageFiles(imageFiles); }
      catch (error) { console.error('Could not remove listing photos from disk:', error.message); }
    }
    res.json({ success: true });
  } catch (e) { next(e); }
});
export default router;
