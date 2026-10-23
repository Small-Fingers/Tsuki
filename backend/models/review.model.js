import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  targetType: { type: String, enum: ['property', 'seller'], required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, trim: true, maxlength: 1200, required: true },
}, { timestamps: true });

reviewSchema.index({ reviewer: 1, property: 1 }, { unique: true, partialFilterExpression: { targetType: 'property' } });
reviewSchema.index({ reviewer: 1, seller: 1 }, { unique: true, partialFilterExpression: { targetType: 'seller' } });
reviewSchema.index({ property: 1, createdAt: -1 });
reviewSchema.index({ seller: 1, createdAt: -1 });

export default mongoose.models.Review || mongoose.model('Review', reviewSchema);
