import mongoose from 'mongoose';

const listingReportSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: {
    type: String,
    enum: ['misleading', 'unavailable', 'suspicious', 'duplicate', 'other'],
    required: true,
  },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed', 'actioned'], default: 'pending' },
  statusUpdatedAt: { type: Date },
  adminNote: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true });

listingReportSchema.index({ property: 1, reporter: 1 }, { unique: true });

export default mongoose.models.ListingReport || mongoose.model('ListingReport', listingReportSchema);
