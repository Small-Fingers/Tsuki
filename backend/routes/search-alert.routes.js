import { Router } from 'express';
import User from '../models/user.model.js';
import Property from '../models/property.model.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildSearchAlertQuery, normalizeFilters } from '../utils/search-alerts.js';

const router = Router();
router.use(requireAuth, requireRole('buyer'));

router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('savedSearches');
    const alerts = await Promise.all((user?.savedSearches || []).map(async (saved) => {
      const filters = normalizeFilters(saved.filters?.toObject?.() || saved.filters || {});
      const query = buildSearchAlertQuery(filters, saved.createdAt);
      const matches = await Property.find(query).sort({ createdAt: -1 }).limit(12).select('title price purpose city area propertyType images createdAt');
      return { _id: saved._id, name: saved.name, filters, createdAt: saved.createdAt, matches };
    }));
    res.json({ alerts });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const filters = normalizeFilters(req.body.filters);
    if (!Object.keys(filters).length) return res.status(400).json({ message: 'Choose at least one filter before saving this search.' });
    const user = await User.findById(req.user._id);
    if (user.savedSearches.length >= 20) return res.status(400).json({ message: 'You can save up to 20 searches.' });
    const name = String(req.body.name || '').trim().slice(0, 80) || [filters.city, filters.propertyType, filters.purpose].filter(Boolean).join(' · ') || 'My search';
    user.savedSearches.push({ name, filters, createdAt: new Date() });
    await user.save();
    res.status(201).json({ savedSearch: user.savedSearches.at(-1) });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $pull: { savedSearches: { _id: req.params.id } } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
