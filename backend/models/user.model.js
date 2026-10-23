import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: String,
  address: String,
  profilePic: String,
  uploadedImageFiles: { type: [String], default: [], select: false },
  savedProperties: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }], default: [] },
  savedSearches: [{
    name: { type: String, required: true, trim: true, maxlength: 80 },
    filters: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
  notificationsSeenAt: Date,
  sessionVersion: { type: Number, default: 0 },
  mustChangePassword: { type: Boolean, default: false },
  role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', schema);
