import 'dotenv/config';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Property from '../models/property.model.js';

function usage() {
  console.error('Usage: npm run import:properties -- --seller <seller-user-id> <properties.json>');
  process.exitCode = 1;
}

const args = process.argv.slice(2);
const sellerIndex = args.indexOf('--seller');
const sellerId = sellerIndex >= 0 ? args[sellerIndex + 1] : null;
const inputPath = args.find((arg, index) => index !== sellerIndex && index !== sellerIndex + 1 && !arg.startsWith('--'));

if (!sellerId || !inputPath) {
  usage();
} else {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in backend/.env');
    const raw = await fs.readFile(inputPath, 'utf8');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('The JSON file must contain a non-empty array of properties');

    await mongoose.connect(process.env.MONGODB_URI);
    const seller = await User.findById(sellerId).select('_id role name');
    if (!seller || !['seller', 'admin'].includes(seller.role)) throw new Error('The supplied user ID must belong to a seller or admin account');

    const records = rows.map((row, index) => {
      const required = ['title', 'description', 'price', 'city', 'area', 'pincode', 'propertyType'];
      const missing = required.filter((field) => row[field] === undefined || row[field] === '');
      if (missing.length) throw new Error(`Property ${index + 1} is missing: ${missing.join(', ')}`);
      return {
        ...row,
        price: Number(row.price),
        images: Array.isArray(row.images) ? row.images : [],
        amenities: Array.isArray(row.amenities) ? row.amenities : [],
        seller: seller._id,
      };
    });

    const imported = await Property.insertMany(records);
    console.log(`Imported ${imported.length} properties for seller ${seller.name} (${seller._id}).`);
  } catch (error) {
    console.error(`Property import failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
