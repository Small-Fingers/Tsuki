import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messages: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        sentAt: { type: Date, default: Date.now },
        readAt: Date,
      },
    ],
  },
  { timestamps: true },
);
schema.index({ buyer: 1, seller: 1, property: 1 }, { unique: true });
export default mongoose.models.Chat || mongoose.model('Chat', schema);
