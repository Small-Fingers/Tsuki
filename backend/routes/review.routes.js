import { Router } from 'express';
import Chat from '../models/chat.model.js';
import Property from '../models/property.model.js';
import Review from '../models/review.model.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/property/:id', async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).select('_id seller');
    if (!property) return res.status(404).json({ message: 'Listing not found.' });
    const [propertyReviews, sellerReviews] = await Promise.all([
      Review.find({ property: property._id, targetType: 'property' }).populate('reviewer', 'name profilePic').sort({ createdAt: -1 }).limit(100),
      Review.find({ seller: property.seller, targetType: 'seller' }).populate('reviewer', 'name profilePic').sort({ createdAt: -1 }).limit(100),
    ]);
    const average = (reviews) => reviews.length ? Number((reviews.reduce((total, review) => total + review.rating, 0) / reviews.length).toFixed(1)) : null;
    res.json({ propertyReviews, sellerReviews, propertyRating: average(propertyReviews), sellerRating: average(sellerReviews) });
  } catch (error) { next(error); }
});

router.get('/property/:id/eligibility', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'buyer') return res.json({ canReviewProperty: false, canReviewSeller: false, propertyReview: null, sellerReview: null });
    const property = await Property.findById(req.params.id).select('_id seller');
    if (!property) return res.status(404).json({ message: 'Listing not found.' });
    const hasMessage = { messages: { $elemMatch: { sender: req.user._id } } };
    const [propertyChat, sellerChat, propertyReview, sellerReview] = await Promise.all([
      Chat.exists({ buyer: req.user._id, property: property._id, ...hasMessage }),
      Chat.exists({ buyer: req.user._id, seller: property.seller, ...hasMessage }),
      Review.findOne({ reviewer: req.user._id, property: property._id, targetType: 'property' }),
      Review.findOne({ reviewer: req.user._id, seller: property.seller, targetType: 'seller' }),
    ]);
    res.json({ canReviewProperty: Boolean(propertyChat), canReviewSeller: Boolean(sellerChat), propertyReview, sellerReview });
  } catch (error) { next(error); }
});

router.post('/property/:id', requireAuth, requireRole('buyer'), async (req, res, next) => {
  try {
    const { targetType } = req.body;
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (!['property', 'seller'].includes(targetType)) return res.status(400).json({ message: 'Choose whether to review the home or its seller.' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Choose a rating from 1 to 5 stars.' });
    if (!comment || comment.length > 1200) return res.status(400).json({ message: 'Write a review between 1 and 1,200 characters.' });
    const property = await Property.findById(req.params.id).select('_id seller');
    if (!property) return res.status(404).json({ message: 'Listing not found.' });
    const conversation = targetType === 'property'
      ? await Chat.exists({ buyer: req.user._id, property: property._id, messages: { $elemMatch: { sender: req.user._id } } })
      : await Chat.exists({ buyer: req.user._id, seller: property.seller, messages: { $elemMatch: { sender: req.user._id } } });
    if (!conversation) return res.status(403).json({ message: 'Send a message about this home before leaving a review.' });
    const identity = targetType === 'property'
      ? { targetType, property: property._id, reviewer: req.user._id }
      : { targetType, seller: property.seller, reviewer: req.user._id };
    const review = await Review.findOneAndUpdate(identity, {
      $set: { ...identity, property: targetType === 'property' ? property._id : null, seller: property.seller, rating, comment },
    }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    res.json({ review, message: 'Your review has been saved.' });
  } catch (error) { next(error); }
});

export default router;
