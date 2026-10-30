import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    purpose: { type: String, enum: ['sale', 'rent'], default: 'sale' },
    city: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    locationPrecision: { type: String, enum: ['approximate', 'exact'], default: 'approximate' },
    propertyType: {
      type: String,
      enum: [
        'flat',
        'apartment',
        'villa',
        'house',
        'studio',
        'penthouse',
        'office',
        'townhouse',
        'plot',
        'commercial',
      ],
      required: true,
    },
    bhk: String,
    bathrooms: Number,
    areaSize: Number,
    furnishing: { type: String, enum: ['furnished', 'semi-furnished', 'unfurnished'] },
    amenities: [String],
    status: { type: String, enum: ['sale', 'sold', 'rented', 'unavailable'], default: 'sale' },
    images: [String],
    imageFiles: [String],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isVerified: { type: Boolean, default: false },
    availabilityConfirmedAt: { type: Date },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.models.Property || mongoose.model('Property', propertySchema);
