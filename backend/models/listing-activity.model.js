import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  views: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  conversations: { type: Number, default: 0 },
  viewings: { type: Number, default: 0 },
}, { timestamps: false });

schema.index({ property: 1, date: 1 }, { unique: true });
schema.index({ seller: 1, date: 1 });
export default mongoose.models.ListingActivity || mongoose.model('ListingActivity', schema);
