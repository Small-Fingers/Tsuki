import { Router } from 'express';
import Chat from '../models/chat.model.js';
import ListingReport from '../models/listing-report.model.js';
import Property from '../models/property.model.js';
import User from '../models/user.model.js';
import Viewing from '../models/viewing.model.js';
import { requireAuth } from '../middleware/auth.js';
import { publishChatUpdate } from '../utils/chatEvents.js';
import { buildSearchAlertQuery, normalizeFilters } from '../utils/search-alerts.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    if (!['buyer', 'seller'].includes(req.user.role)) return res.json({ notifications: [], unreadCount: 0 });
    const userId = req.user._id;
    let seenAt = req.user.notificationsSeenAt;
    if (!seenAt) {
      seenAt = new Date();
      await User.updateOne({ _id: req.user._id }, { $set: { notificationsSeenAt: seenAt } });
    }
    const recentAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const chatQuery = { $or: [{ buyer: userId }, { seller: userId }] };
    const viewingQuery = req.user.role === 'seller' ? { seller: userId } : { buyer: userId };
    const [chats, viewings, reports] = await Promise.all([
      Chat.find(chatQuery).populate('buyer seller', 'name').populate('property', 'title').sort({ updatedAt: -1 }),
      Viewing.find(viewingQuery).populate('property', 'title').populate('buyer seller', 'name').sort({ updatedAt: -1 }).limit(200),
      req.user.role === 'buyer'
        ? ListingReport.find({ reporter: userId, status: { $ne: 'pending' } }).populate('property', 'title').sort({ statusUpdatedAt: -1, updatedAt: -1 }).limit(100)
        : Promise.resolve([]),
    ]);

    const notifications = [];
    let unreadCount = 0;
    for (const chat of chats) {
      const partner = String(chat.buyer?._id || chat.buyer) === String(userId) ? chat.seller : chat.buyer;
      for (const message of chat.messages || []) {
        if (String(message.sender?._id || message.sender) === String(userId)) continue;
        const sentAt = message.sentAt || chat.updatedAt;
        const unread = !message.readAt;
        if (!unread && sentAt < recentAfter) continue;
        if (unread) unreadCount += 1;
        notifications.push({
          id: `message:${chat._id}:${message._id}`,
          type: 'message',
          title: `Message from ${partner?.name || 'Tsuki member'}`,
          body: `${chat.property?.title ? `${chat.property.title} · ` : ''}${message.text.slice(0, 180)}${message.text.length > 180 ? '…' : ''}`,
          createdAt: sentAt,
          href: `/messages/${chat._id}`,
          unread,
        });
      }
    }

    for (const viewing of viewings) {
      let title;
      let body;
      let createdAt;
      let type = 'viewing';
      const startsInMs = new Date(viewing.requestedFor).getTime() - Date.now();
      if (viewing.status === 'accepted' && startsInMs > 0 && startsInMs <= 24 * 60 * 60 * 1000) {
        type = 'reminder';
        const startsIn = startsInMs < 60 * 60 * 1000 ? 'in less than an hour' : `in ${Math.ceil(startsInMs / (60 * 60 * 1000))} hours`;
        title = 'Viewing coming up';
        body = `${viewing.property?.title || 'Your property viewing'} · ${startsIn} · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(viewing.requestedFor))}`;
        createdAt = new Date(Math.max(new Date(viewing.requestedFor).getTime() - 24 * 60 * 60 * 1000, new Date(viewing.updatedAt || viewing.createdAt).getTime()));
      } else if (req.user.role === 'seller' && viewing.status === 'pending') {
        title = 'New viewing request';
        body = `${viewing.buyer?.name || 'A buyer'} requested to view ${viewing.property?.title || 'your listing'}.`;
        createdAt = viewing.createdAt;
      } else if (req.user.role === 'seller' && viewing.status === 'cancelled') {
        title = 'Viewing request cancelled';
        body = `${viewing.buyer?.name || 'The buyer'} cancelled a request for ${viewing.property?.title || 'your listing'}.`;
        createdAt = viewing.updatedAt;
      } else if (req.user.role === 'buyer' && ['accepted', 'declined'].includes(viewing.status)) {
        title = viewing.status === 'accepted' ? 'Viewing request accepted' : 'Viewing request declined';
        body = `${viewing.property?.title || 'Your listing request'} · ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(viewing.requestedFor))}`;
        createdAt = viewing.updatedAt;
      } else continue;

      const unread = new Date(createdAt) > seenAt;
      if (!unread && new Date(createdAt) < recentAfter) continue;
      if (unread) unreadCount += 1;
      notifications.push({ id: `viewing:${viewing._id}:${viewing.status}`, type, title, body, createdAt, href: '/viewings', unread });
    }

    for (const report of reports) {
      const createdAt = report.statusUpdatedAt || report.updatedAt || report.createdAt;
      const unread = new Date(createdAt) > seenAt;
      if (!unread && new Date(createdAt) < recentAfter) continue;
      const listing = report.property?.title || 'the listing you reported';
      const outcomes = {
        reviewed: `Your report about “${listing}” has been reviewed. The team will follow up if further action is needed.`,
        actioned: `Our team reviewed your report about “${listing}” and took action on the listing.`,
        dismissed: `Our team reviewed your report about “${listing}” and decided no further action is needed.`,
      };
      if (unread) unreadCount += 1;
      notifications.push({
        id: `report:${report._id}:${report.status}`,
        type: 'report',
        title: 'Listing report update',
        body: outcomes[report.status],
        createdAt,
        href: report.property?._id ? `/properties/${report.property._id}` : '/notifications',
        unread,
      });
    }

    if (req.user.role === 'buyer') {
      for (const saved of req.user.savedSearches || []) {
        const filters = normalizeFilters(saved.filters?.toObject?.() || saved.filters || {});
        const query = buildSearchAlertQuery(filters, saved.createdAt);
        const [count, latest] = await Promise.all([
          Property.countDocuments(query),
          Property.findOne(query).sort({ createdAt: -1 }).select('createdAt'),
        ]);
        if (!count || !latest) continue;
        const unread = latest.createdAt > seenAt;
        if (unread) unreadCount += 1;
        notifications.push({
          id: `search:${saved._id}`,
          type: 'search',
          title: `New matches for ${saved.name}`,
          body: `${count} new ${count === 1 ? 'match' : 'matches'} found for this saved search.`,
          createdAt: latest.createdAt,
          href: '/alerts',
          unread,
        });
      }
    }

    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ notifications: notifications.slice(0, 100), unreadCount });
  } catch (error) { next(error); }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const now = new Date();
    if (['buyer', 'seller'].includes(req.user.role)) {
      const chatQuery = { $or: [{ buyer: req.user._id }, { seller: req.user._id }] };
      const chats = await Chat.find(chatQuery).select('_id');
      await Chat.updateMany(chatQuery, { $set: { 'messages.$[incoming].readAt': now } }, { arrayFilters: [{ 'incoming.sender': { $ne: req.user._id }, 'incoming.readAt': null }] });
      await User.updateOne({ _id: req.user._id }, { $set: { notificationsSeenAt: now } });
      for (const chat of chats) publishChatUpdate([req.user._id], chat._id);
    }
    res.json({ success: true, notificationsSeenAt: now });
  } catch (error) { next(error); }
});

export default router;
