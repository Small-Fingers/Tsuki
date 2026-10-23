import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Property from '../models/property.model.js';
import User from '../models/user.model.js';
import Contact from '../models/contact.model.js';
import ListingReport from '../models/listing-report.model.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { deleteImageFiles, propertyImageFilenames } from '../utils/local-images.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/overview', async (_req, res, next) => {
  try {
    const [userCount, roles, propertyCount, saleListings, rentalListings, soldListings, views, recentProperties] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Property.countDocuments(),
      Property.countDocuments({ status: 'sale', $or: [{ purpose: 'sale' }, { purpose: { $exists: false } }] }),
      Property.countDocuments({ status: 'sale', purpose: 'rent' }),
      Property.countDocuments({ status: 'sold' }),
      Property.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      Property.find().populate('seller', 'name email').sort({ createdAt: -1 }).limit(6),
    ]);
    res.json({
      users: userCount,
      roles: Object.fromEntries(roles.map(({ _id, count }) => [_id, count])),
      properties: propertyCount,
      liveListings: saleListings + rentalListings,
      saleListings,
      rentalListings,
      soldListings,
      totalViews: views[0]?.total || 0,
      recentProperties,
    });
  } catch (error) { next(error); }
});

router.get('/users', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.role && ['buyer', 'seller', 'admin'].includes(req.query.role)) query.role = req.query.role;
    if (req.query.search) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [{ name: new RegExp(escaped, 'i') }, { email: new RegExp(escaped, 'i') }];
    }
    const users = await User.find(query).select('name email role phone createdAt').sort({ createdAt: -1 }).limit(200);
    res.json({ users });
  } catch (error) { next(error); }
});

router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['buyer', 'seller', 'admin'].includes(role)) return res.status(400).json({ message: 'Choose a valid account role' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID' });
    if (String(req.user._id) === req.params.id) return res.status(400).json({ message: 'You cannot change your own admin role' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin' && role !== 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) {
      return res.status(409).json({ message: 'The last admin account cannot be demoted' });
    }
    user.role = role;
    await user.save();
    res.json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, createdAt: user.createdAt } });
  } catch (error) { next(error); }
});

router.patch('/users/:id/password', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID' });
    if (String(req.user._id) === req.params.id) return res.status(400).json({ message: 'Use your profile to change your own password.' });
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < 12) return res.status(400).json({ message: 'Temporary passwords must be at least 12 characters.' });
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = await bcrypt.hash(password, 12);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    user.mustChangePassword = true;
    await user.save();
    res.json({ success: true, message: 'Temporary password set. The user must sign in again and change it from their profile.' });
  } catch (error) { next(error); }
});

router.get('/properties', async (req, res, next) => {
  try {
    const query = {};
    if (['sale', 'sold', 'rented', 'unavailable'].includes(req.query.status)) query.status = req.query.status;
    if (req.query.verification === 'verified') query.isVerified = true;
    if (req.query.verification === 'unverified') query.isVerified = false;
    const properties = await Property.find(query).populate('seller', 'name email').sort({ createdAt: -1 }).limit(200);
    res.json({ properties });
  } catch (error) { next(error); }
});

router.get('/contacts', async (_req, res, next) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }).limit(200);
    res.json({ contacts });
  } catch (error) { next(error); }
});

router.patch('/contacts/:id', async (req, res, next) => {
  try {
    if (!['new', 'resolved'].includes(req.body.status)) return res.status(400).json({ message: 'Choose new or resolved status.' });
    const contact = await Contact.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!contact) return res.status(404).json({ message: 'Contact request not found.' });
    res.json({ contact });
  } catch (error) { next(error); }
});

router.get('/reports', async (req, res, next) => {
  try {
    const query = {};
    if (['pending', 'reviewed', 'dismissed', 'actioned'].includes(req.query.status)) query.status = req.query.status;
    const reports = await ListingReport.find(query)
      .populate({ path: 'property', select: 'title city area price purpose status seller', populate: { path: 'seller', select: 'name email' } })
      .populate('reporter', 'name email')
      .sort({ createdAt: -1 }).limit(300);
    res.json({ reports });
  } catch (error) { next(error); }
});

router.patch('/reports/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid report ID.' });
    const { status } = req.body;
    if (!['reviewed', 'dismissed', 'actioned'].includes(status)) return res.status(400).json({ message: 'Choose a valid report status.' });
    const adminNote = typeof req.body.adminNote === 'string' ? req.body.adminNote.trim().slice(0, 1000) : '';
    const reportRecord = await ListingReport.findById(req.params.id);
    if (!reportRecord) return res.status(404).json({ message: 'Report not found.' });
    if (reportRecord.status !== status) reportRecord.statusUpdatedAt = new Date();
    else if (reportRecord.status !== 'pending' && !reportRecord.statusUpdatedAt) reportRecord.statusUpdatedAt = reportRecord.updatedAt;
    reportRecord.status = status;
    reportRecord.adminNote = adminNote;
    await reportRecord.save();
    const report = await ListingReport.findById(reportRecord._id)
      .populate({ path: 'property', select: 'title city area price purpose status seller', populate: { path: 'seller', select: 'name email' } })
      .populate('reporter', 'name email');
    res.json({ report });
  } catch (error) { next(error); }
});

router.patch('/properties/:id/verification', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid property ID' });
    if (typeof req.body.isVerified !== 'boolean') return res.status(400).json({ message: 'isVerified must be true or false' });
    const property = await Property.findByIdAndUpdate(req.params.id, { isVerified: req.body.isVerified }, { new: true })
      .populate('seller', 'name email');
    if (!property) return res.status(404).json({ message: 'Listing not found' });
    res.json({ property });
  } catch (error) { next(error); }
});

router.delete('/properties/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid property ID' });
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Listing not found' });
    await property.deleteOne();
    const imageFiles = propertyImageFilenames(property);
    if (imageFiles.length) {
      try { await deleteImageFiles(imageFiles); }
      catch (error) { console.error('Could not remove listing photos from disk:', error.message); }
    }
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
