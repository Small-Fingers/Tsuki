import { Router } from 'express';
import mongoose from 'mongoose';
import Property from '../models/property.model.js';
import Viewing from '../models/viewing.model.js';
import ViewingSlot from '../models/viewing-slot.model.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordListingActivity } from '../utils/listing-activity.js';

const router = Router();
const MAX_DAYS_AHEAD = 60;
const SLOT_MINUTES = 30;
const slotEnd = (start) => new Date(start.getTime() + SLOT_MINUTES * 60_000);
const populateViewing = (query) => query.populate('property', 'title price images city area purpose status').populate('buyer seller', 'name email phone profilePic').populate('slot');
const icsDate = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const icsEscape = (value = '') => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
router.use(requireAuth);

router.get('/availability/mine', requireRole('seller'), async (req, res, next) => {
  try {
    const slots = await ViewingSlot.find({ seller: req.user._id, startsAt: { $gte: new Date() } })
      .populate('property', 'title city area status images').sort({ startsAt: 1 }).limit(500);
    res.json({ slots });
  } catch (error) { next(error); }
});

router.get('/availability', requireRole('buyer'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.propertyId)) return res.status(400).json({ message: 'Choose a valid listing.' });
    const slots = await ViewingSlot.find({ property: req.query.propertyId, status: 'available', startsAt: { $gt: new Date(), $lte: new Date(Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) } }).sort({ startsAt: 1 }).limit(100).select('startsAt endsAt');
    res.json({ slots });
  } catch (error) { next(error); }
});

router.post('/availability', requireRole('seller'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.propertyId)) return res.status(400).json({ message: 'Choose one of your listings.' });
    const property = await Property.findOne({ _id: req.body.propertyId, seller: req.user._id }).select('_id seller status purpose');
    if (!property || property.status !== 'sale' || property.purpose === 'rent') return res.status(404).json({ message: 'Choose an available sale listing that you own.' });
    const startsAt = new Date(req.body.startsAt);
    const limit = new Date(Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000);
    if (Number.isNaN(startsAt.valueOf()) || startsAt <= new Date() || startsAt > limit) return res.status(400).json({ message: 'Choose a future time within the next 60 days.' });
    if (![0, 30].includes(startsAt.getMinutes()) || startsAt.getSeconds() !== 0) return res.status(400).json({ message: 'Viewing slots must start on the hour or half hour.' });
    const slot = await ViewingSlot.create({ property: property._id, seller: req.user._id, startsAt, endsAt: slotEnd(startsAt) });
    const result = await ViewingSlot.findById(slot._id).populate('property', 'title city area status images');
    res.status(201).json({ slot: result });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'You already have a viewing time at that hour, possibly for another listing.' });
    next(error);
  }
});

router.delete('/availability/:id', requireRole('seller'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid viewing slot.' });
    const slot = await ViewingSlot.findOne({ _id: req.params.id, seller: req.user._id });
    if (!slot) return res.status(404).json({ message: 'Viewing slot not found.' });
    if (slot.status !== 'available') return res.status(409).json({ message: 'A requested or booked slot cannot be removed.' });
    await slot.deleteOne();
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const query = req.user.role === 'seller' ? { seller: req.user._id } : { buyer: req.user._id };
    const viewings = await populateViewing(Viewing.find(query).sort({ requestedFor: 1 }));
    res.json({ viewings });
  } catch (error) { next(error); }
});

router.get('/:id/calendar', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid viewing request.' });
    const viewing = await populateViewing(Viewing.findById(req.params.id));
    if (!viewing) return res.status(404).json({ message: 'Viewing request not found.' });
    if (![String(viewing.buyer?._id), String(viewing.seller?._id)].includes(String(req.user._id))) return res.status(403).json({ message: 'This viewing request is private.' });
    if (viewing.status !== 'accepted') return res.status(409).json({ message: 'Only confirmed viewings can be added to your calendar.' });
    const location = [viewing.property?.area, viewing.property?.city].filter(Boolean).join(', ');
    const description = `Buyer: ${viewing.buyer?.name || 'Tsuki member'}\nSeller: ${viewing.seller?.name || 'Tsuki member'}${viewing.note ? `\nNote: ${viewing.note}` : ''}`;
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tsuki//Viewing Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:${viewing._id}@tsuki`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(viewing.requestedFor)}`,
      `DTEND:${icsDate(viewing.slot?.endsAt || slotEnd(viewing.requestedFor))}`, `SUMMARY:${icsEscape(`Viewing: ${viewing.property?.title || 'Property'}`)}`,
      `DESCRIPTION:${icsEscape(description)}`, `LOCATION:${icsEscape(location)}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR', '',
    ];
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="tsuki-viewing-${viewing._id}.ics"`, 'Cache-Control': 'no-store' });
    res.send(lines.join('\r\n'));
  } catch (error) { next(error); }
});

router.post('/', requireRole('buyer'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.slotId)) return res.status(400).json({ message: 'Choose an available viewing time.' });
    const note = String(req.body.note || '').trim();
    if (note.length > 1000) return res.status(400).json({ message: 'The note can be up to 1,000 characters.' });
    const slot = await ViewingSlot.findOneAndUpdate({ _id: req.body.slotId, status: 'available', startsAt: { $gt: new Date() } }, { $set: { status: 'pending' } }, { new: true });
    if (!slot) return res.status(409).json({ message: 'That time is no longer available. Choose another slot.' });
    const property = await Property.findOne({ _id: slot.property, seller: slot.seller, status: 'sale' }).select('_id seller');
    if (!property) {
      await ViewingSlot.updateOne({ _id: slot._id, status: 'pending' }, { $set: { status: 'available' } });
      return res.status(404).json({ message: 'This listing is no longer available.' });
    }
    if (String(property.seller) === String(req.user._id)) {
      await ViewingSlot.updateOne({ _id: slot._id, status: 'pending' }, { $set: { status: 'available' } });
      return res.status(400).json({ message: 'You cannot request a viewing for your own listing.' });
    }
    try {
      const viewing = await Viewing.create({ property: property._id, buyer: req.user._id, seller: property.seller, slot: slot._id, requestedFor: slot.startsAt, note });
      await recordListingActivity(property._id, property.seller, 'viewings');
      const result = await populateViewing(Viewing.findById(viewing._id));
      return res.status(201).json({ viewing: result });
    } catch (error) {
      await ViewingSlot.updateOne({ _id: slot._id, status: 'pending' }, { $set: { status: 'available' } });
      throw error;
    }
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid viewing request.' });
    const viewing = await Viewing.findById(req.params.id);
    if (!viewing) return res.status(404).json({ message: 'Viewing request not found.' });
    const isSeller = String(viewing.seller) === String(req.user._id);
    const isBuyer = String(viewing.buyer) === String(req.user._id);
    if (!isSeller && !isBuyer) return res.status(403).json({ message: 'This viewing request is private.' });
    const status = String(req.body.status || '');
    if (isSeller && !['accepted', 'declined'].includes(status)) return res.status(400).json({ message: 'Choose accept or decline.' });
    if (isBuyer && status !== 'cancelled') return res.status(400).json({ message: 'Buyers can cancel their request.' });
    if (isSeller && viewing.status !== 'pending') return res.status(409).json({ message: 'This request has already been handled.' });
    if (isBuyer && !['pending', 'accepted'].includes(viewing.status)) return res.status(409).json({ message: 'This viewing can no longer be cancelled.' });

    if (status === 'accepted') {
      const propertyAvailable = await Property.exists({ _id: viewing.property, seller: viewing.seller, status: 'sale', purpose: { $ne: 'rent' } });
      if (!propertyAvailable) return res.status(409).json({ message: 'This listing is no longer available for viewings.' });
      const endsAt = slotEnd(viewing.requestedFor);
      const conflict = await Viewing.exists({ _id: { $ne: viewing._id }, seller: viewing.seller, status: 'accepted', requestedFor: { $lt: endsAt, $gt: new Date(viewing.requestedFor.getTime() - SLOT_MINUTES * 60_000) } });
      if (conflict) return res.status(409).json({ message: 'Another viewing is already confirmed during this time.' });
      if (viewing.slot) {
        const reserved = await ViewingSlot.findOneAndUpdate({ _id: viewing.slot, status: 'pending' }, { $set: { status: 'booked' } }, { new: true });
        if (!reserved) return res.status(409).json({ message: 'This time is no longer available. Refresh the request and contact the buyer.' });
      }
    }
    viewing.status = status;
    await viewing.save();
    if (['declined', 'cancelled'].includes(status) && viewing.slot && viewing.requestedFor > new Date()) {
      await ViewingSlot.updateOne({ _id: viewing.slot, status: { $in: ['pending', 'booked'] } }, { $set: { status: 'available' } });
    }
    const result = await populateViewing(Viewing.findById(viewing._id));
    res.json({ viewing: result });
  } catch (error) { next(error); }
});

export default router;
