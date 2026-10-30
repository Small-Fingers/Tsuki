import { Router } from 'express';
import mongoose from 'mongoose';
import ListingReport from '../models/listing-report.model.js';
import Property from '../models/property.model.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('buyer'));

router.post('/property/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: 'Invalid listing ID.' });
    const allowedReasons = ['misleading', 'unavailable', 'suspicious', 'duplicate', 'other'];
    const reason = String(req.body.reason || '');
    const details =
      typeof req.body.details === 'string' ? req.body.details.trim().slice(0, 1000) : '';
    if (!allowedReasons.includes(reason))
      return res.status(400).json({ message: 'Choose a reason for reporting this listing.' });

    const property = await Property.findById(req.params.id).select('seller title');
    if (!property) return res.status(404).json({ message: 'Listing not found.' });
    if (String(property.seller) === String(req.user._id))
      return res.status(403).json({ message: 'You cannot report your own listing.' });

    try {
      const report = await ListingReport.create({
        property: property._id,
        reporter: req.user._id,
        reason,
        details,
      });
      return res.status(201).json({
        success: true,
        reportId: report._id,
        message: 'Thank you. Your report was sent to the Tsuki review team.',
      });
    } catch (error) {
      if (error.code === 11000)
        return res.status(409).json({ message: 'You have already reported this listing.' });
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
