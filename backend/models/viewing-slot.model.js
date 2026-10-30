import mongoose from 'mongoose';

const viewingSlotSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['available', 'pending', 'booked'], default: 'available' },
  },
  { timestamps: true },
);

viewingSlotSchema.index({ seller: 1, startsAt: 1 }, { unique: true });

export default mongoose.models.ViewingSlot || mongoose.model('ViewingSlot', viewingSlotSchema);
