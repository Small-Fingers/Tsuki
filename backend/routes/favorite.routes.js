import { Router } from 'express';
import Property from '../models/property.model.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { publicProperty } from '../utils/public-property.js';
import { recordListingActivity } from '../utils/listing-activity.js';

const router = Router();
router.use(requireAuth, requireRole('buyer'));

router.get('/', async (req, res, next) => {
  try {
    const buyer = await req.user.populate({ path: 'savedProperties', populate: { path: 'seller', select: 'name phone profilePic' } });
    res.json({ properties: buyer.savedProperties.filter(Boolean).map(publicProperty) });
  } catch (error) { next(error); }
});

router.put('/:propertyId', async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.propertyId).select('_id seller');
    if (!property) return res.status(404).json({ message: 'Listing not found.' });
    const result = await req.user.updateOne({ $addToSet: { savedProperties: property._id } });
    if (result.modifiedCount) await recordListingActivity(property._id, property.seller, 'saves');
    res.json({ saved: true, propertyId: String(property._id) });
  } catch (error) { next(error); }
});

router.delete('/:propertyId', async (req, res, next) => {
  try {
    await req.user.updateOne({ $pull: { savedProperties: req.params.propertyId } });
    res.json({ saved: false, propertyId: req.params.propertyId });
  } catch (error) { next(error); }
});

export default router;
