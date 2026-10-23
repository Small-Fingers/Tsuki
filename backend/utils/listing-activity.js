import ListingActivity from '../models/listing-activity.model.js';

const activityFields = new Set(['views', 'saves', 'conversations', 'viewings']);

export function utcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function recordListingActivity(propertyId, sellerId, field, amount = 1) {
  if (!activityFields.has(field) || amount <= 0) return;
  const date = utcDay();
  try {
    await ListingActivity.updateOne(
      { property: propertyId, date },
      { $setOnInsert: { property: propertyId, seller: sellerId, date }, $inc: { [field]: amount } },
      { upsert: true },
    );
  } catch (error) {
    console.error(`Could not record listing ${field} activity:`, error.message);
  }
}
