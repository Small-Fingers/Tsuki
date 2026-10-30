import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  address: user.address,
  profilePic: user.profilePic,
  mustChangePassword: user.mustChangePassword || false,
});
const session = (user) => ({
  token: jwt.sign({ id: user._id, version: user.sessionVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  }),
  user: publicUser(user),
});

router.post('/register', async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = req.body.role || 'buyer';
    if (
      !name ||
      name.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8
    ) {
      return res
        .status(400)
        .json({ message: 'Enter a name, valid email, and password of at least 8 characters.' });
    }
    if (!['buyer', 'seller'].includes(role))
      return res.status(400).json({ message: 'Invalid account type' });

    const user = await User.create({
      name,
      email,
      phone: req.body.phone,
      role,
      password: await bcrypt.hash(password, 12),
    });
    res.status(201).json(session(user));
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ message: 'An account with that email already exists' });
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }
    res.json(session(user));
  } catch (error) {
    next(error);
  }
});

router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword =
      typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 8)
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    if (currentPassword === newPassword)
      return res
        .status(400)
        .json({ message: 'Choose a new password different from your current one.' });

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }
    user.password = await bcrypt.hash(newPassword, 12);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    user.mustChangePassword = false;
    await user.save();
    res.json({ ...session(user), success: true, message: 'Password updated.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    for (const field of ['name', 'phone', 'address', 'profilePic']) {
      if (req.body[field] !== undefined) req.user[field] = String(req.body[field]).trim();
    }
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
