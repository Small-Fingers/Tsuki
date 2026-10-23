import { Router } from 'express';
import Chat from '../models/chat.model.js';
import Property from '../models/property.model.js';
import User from '../models/user.model.js';
import { requireAuth } from '../middleware/auth.js';
import { publishChatUpdate, subscribeToChatUpdates } from '../utils/chatEvents.js';
import { recordListingActivity } from '../utils/listing-activity.js';

const router = Router();
router.use(requireAuth);
router.get('/', async (req, res, next) => {
  try { const chats = await Chat.find({ $or: [{ buyer: req.user._id }, { seller: req.user._id }] }).populate('buyer seller', 'name email profilePic').populate('property', 'title price images').sort({ updatedAt: -1 }); res.json({ chats }); } catch (e) { next(e); }
});
router.get('/events', (req, res) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  const unsubscribe = subscribeToChatUpdates(req.user._id, res);
  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) res.write(': ping\n\n');
  }, 25000);
  const close = () => { clearInterval(heartbeat); unsubscribe(); };
  res.on('close', close);
});
router.get('/:id', async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id).populate('buyer seller', 'name email profilePic').populate('property', 'title price images');
    if (!chat) return res.status(404).json({ message: 'Conversation not found' });
    if (![String(chat.buyer._id), String(chat.seller._id)].includes(String(req.user._id))) return res.status(403).json({ message: 'This conversation is private' });
    res.json({ chat });
  } catch (error) { next(error); }
});
router.post('/start', async (req, res, next) => {
  try {
    if (!['buyer', 'seller'].includes(req.user.role)) return res.status(403).json({ message: 'Only buyers and sellers can start conversations.' });
    const buyer = req.user.role === 'seller' ? req.body.buyerId : req.user._id;
    const seller = req.user.role === 'seller' ? req.user._id : req.body.sellerId;
    if (!buyer || !seller || String(buyer) === String(seller)) return res.status(400).json({ message: 'A buyer and a different seller are required' });
    const [buyerUser, sellerUser] = await Promise.all([User.findById(buyer).select('_id role'), User.findById(seller).select('_id role')]);
    if (!buyerUser || buyerUser.role !== 'buyer' || !sellerUser || sellerUser.role !== 'seller') return res.status(400).json({ message: 'Choose an existing buyer and seller account.' });
    let listing;
    if (req.body.propertyId) {
      listing = await Property.findById(req.body.propertyId).select('seller');
      if (!listing) return res.status(404).json({ message: 'Listing not found.' });
      if (String(listing.seller) !== String(seller)) return res.status(400).json({ message: 'This listing does not belong to that seller.' });
    }
    let chat = await Chat.findOne({ buyer, seller, property: req.body.propertyId || null });
    if (!chat) {
      chat = await Chat.create({ buyer, seller, property: req.body.propertyId || undefined });
      if (listing) await recordListingActivity(listing._id, listing.seller, 'conversations');
    }
    publishChatUpdate([buyer, seller], chat._id);
    chat = await Chat.findById(chat._id).populate('buyer seller', 'name email profilePic').populate('property', 'title price images');
    res.json({ chat });
  } catch (e) { next(e); }
});
router.post('/:id/messages', async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ message: 'Conversation not found' });
    if (![String(chat.buyer), String(chat.seller)].includes(String(req.user._id))) return res.status(403).json({ message: 'This conversation is private' });
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Message cannot be empty' });
    if (text.length > 4000) return res.status(400).json({ message: 'Messages can be up to 4,000 characters.' });
    chat.messages.push({ sender: req.user._id, text });
    await chat.save();
    publishChatUpdate([chat.buyer, chat.seller], chat._id);
    res.status(201).json({ chat });
  } catch (error) { next(error); }
});
router.post('/:id/read', async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ message: 'Conversation not found' });
    if (![String(chat.buyer), String(chat.seller)].includes(String(req.user._id))) return res.status(403).json({ message: 'This conversation is private' });
    const now = new Date();
    let changed = false;
    for (const message of chat.messages) {
      if (String(message.sender) !== String(req.user._id) && !message.readAt) { message.readAt = now; changed = true; }
    }
    if (changed) {
      await chat.save();
      publishChatUpdate([chat.buyer, chat.seller], chat._id);
    }
    res.json({ success: true });
  } catch (error) { next(error); }
});
export default router;
