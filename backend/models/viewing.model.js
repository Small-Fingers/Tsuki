import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slot: { type: mongoose.Schema.Types.ObjectId, ref: 'ViewingSlot' },
  requestedFor: { type: Date, required: true },
  note: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled'], default: 'pending' },
}, { timestamps: true });

schema.index({ property: 1, buyer: 1, requestedFor: 1 });
export default mongoose.models.Viewing || mongoose.model('Viewing', schema);
