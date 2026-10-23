import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { deleteImageFiles, imageStorageDir } from '../utils/local-images.js';
import User from '../models/user.model.js';

const router = Router();
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
class UnsupportedImageTypeError extends Error {}
const upload = multer({
  storage: multer.diskStorage({
    destination: imageStorageDir,
    filename: (_req, file, callback) => callback(null, `${randomUUID()}.${extensions[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, callback) => acceptedTypes.has(file.mimetype)
    ? callback(null, true)
    : callback(new UnsupportedImageTypeError('Use JPG, PNG, WebP, or AVIF images')),
});

router.post('/images', requireAuth, requireRole('seller', 'admin'), upload.array('images', 8), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'Choose at least one JPG, PNG, WebP, or AVIF image (maximum 8 MB each)' });
    const filenames = req.files.map(({ filename }) => filename);
    try {
      await req.user.updateOne({ $addToSet: { uploadedImageFiles: { $each: filenames } } });
    } catch (error) {
      await deleteImageFiles(filenames).catch((cleanupError) => console.error('Could not clean up uploaded photos:', cleanupError.message));
      throw error;
    }
    const apiOrigin = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    res.status(201).json({ images: req.files.map(({ filename }) => ({ url: `${apiOrigin}/uploads/${encodeURIComponent(filename)}`, filename })) });
  } catch (error) { next(error); }
});

router.delete('/images', requireAuth, requireRole('seller', 'admin'), async (req, res, next) => {
  try {
    const filenames = Array.isArray(req.body.filenames) ? [...new Set(req.body.filenames)] : [];
    const user = await User.findById(req.user._id).select('+uploadedImageFiles');
    if (!filenames.length || filenames.some((filename) => !user.uploadedImageFiles.includes(filename))) return res.status(403).json({ message: 'These photos cannot be removed from your pending uploads.' });
    await deleteImageFiles(filenames);
    await user.updateOne({ $pull: { uploadedImageFiles: { $in: filenames } } });
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
