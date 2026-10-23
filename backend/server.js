import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';
import propertyRoutes from './routes/property.routes.js';
import chatRoutes from './routes/chat.routes.js';
import imageRoutes from './routes/image.routes.js';
import adminRoutes from './routes/admin.routes.js';
import contactRoutes from './routes/contact.routes.js';
import reviewRoutes from './routes/review.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import viewingRoutes from './routes/viewing.routes.js';
import searchAlertRoutes from './routes/search-alert.routes.js';
import reportRoutes from './routes/report.routes.js';
import { imageStorageDir } from './utils/local-images.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(imageStorageDir, { immutable: true, maxAge: '1y', index: false }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/property', propertyRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/viewings', viewingRoutes);
app.use('/api/search-alerts', searchAlertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/property', imageRoutes);
app.use((req, res) => res.status(404).json({ message: `No route for ${req.method} ${req.path}` }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Each photo must be 8 MB or smaller' });
  if (err.name === 'MulterError') return res.status(400).json({ message: err.message });
  if (err.name === 'UnsupportedImageTypeError') return res.status(400).json({ message: err.message });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier' });
  res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message });
});

const port = Number(process.env.PORT || 5000);
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, () => console.log(`API listening on port ${port}`));
  }).catch((error) => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
} else {
  app.listen(port, () => console.log(`API listening on port ${port}; set MONGODB_URI to enable database routes`));
}
