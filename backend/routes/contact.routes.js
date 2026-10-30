import { Router } from 'express';
import Contact from '../models/contact.model.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use((req, res, next) => (req.headers.authorization ? requireAuth(req, res, next) : next()));
router.post('/', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    if (
      ![name, email, subject, message].every((value) => typeof value === 'string' && value.trim())
    ) {
      return res.status(400).json({ message: 'Name, email, subject, and message are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (
      name.trim().length > 120 ||
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      subject.trim().length > 160 ||
      message.trim().length > 5000
    ) {
      return res.status(400).json({
        message: 'Check the email address and keep each field within its allowed length.',
      });
    }
    const contact = await Contact.create({
      name,
      email: normalizedEmail,
      subject,
      message,
      user: req.user?._id,
    });
    res.status(201).json({ success: true, contactId: contact._id });
  } catch (error) {
    next(error);
  }
});

export default router;
