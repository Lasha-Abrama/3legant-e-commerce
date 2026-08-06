import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Product, ProductSchema } from './products/schemas/product.schema';
import { User, UserSchema } from './users/schemas/user.schema';

const BLACK = { name: 'Black', hex: '#2a2a28' };
const GRAY = { name: 'Gray', hex: '#8f8b83' };
const RED = { name: 'Red', hex: '#a63b34' };
const WHITE = { name: 'White', hex: '#efece5' };
const GOLD = { name: 'Gold', hex: '#c9a05a' };
const BEIGE = { name: 'Beige', hex: '#d8cfc0' };

const products = [
  {
    name: 'Tray Table',
    category: 'Living Room',
    price: 19,
    originalPrice: 38,
    colors: [BLACK, GRAY, RED, WHITE],
    newArrival: true,
    discountLabel: '-50%',
    sku: 'LC-1117',
    measurements: '17 1/2 × 20 5/8 "',
    description:
      "Buy one or a few and make every space you sit more convenient. Light and easy to move around with removable tray top, handy for serving snacks.",
    imageLabel: 'Tray Table photo',
  },
  {
    name: 'Loveseat Sofa',
    category: 'Living Room',
    price: 199,
    originalPrice: 400,
    colors: [BEIGE, GRAY],
    newArrival: true,
    discountLabel: '-50%',
    sku: 'LC-1201',
    measurements: '54 × 33 × 32 "',
    description: 'A compact two-seat sofa with a soft upholstered frame, perfect for smaller living rooms and reading corners.',
    imageLabel: 'Loveseat Sofa photo',
  },
  {
    name: 'Luxury Sofa',
    category: 'Living Room',
    price: 399,
    colors: [BEIGE, GRAY, BLACK],
    newArrival: true,
    sku: 'LC-1202',
    measurements: '84 × 36 × 34 "',
    description: 'A generously cushioned three-seat sofa upholstered in a durable woven fabric, built for everyday comfort.',
    imageLabel: 'Luxury Sofa photo',
  },
  {
    name: 'Beige Sofa',
    category: 'Living Room',
    price: 345,
    colors: [BEIGE],
    sku: 'LC-1203',
    measurements: '78 × 34 × 33 "',
    description: 'A warm beige sofa with curved wooden legs and plush seat cushions, designed to anchor any living room.',
    imageLabel: 'Beige Sofa photo',
  },
  {
    name: 'Floor Lamp',
    category: 'Living Room',
    price: 36,
    colors: [BLACK, GOLD],
    newArrival: true,
    sku: 'LC-1303',
    measurements: '14 × 14 × 58 "',
    description: 'A slim floor lamp with a fabric shade that casts a warm, diffused glow across the room.',
    imageLabel: 'Floor Lamp photo',
  },
  {
    name: 'Amber Table Lamp',
    category: 'Bedroom',
    price: 32,
    colors: [GOLD, WHITE],
    newArrival: true,
    sku: 'LC-1301',
    measurements: '8 × 8 × 16 "',
    description: 'A hand-blown amber glass table lamp that adds a soft, honeyed glow to any nightstand or console.',
    imageLabel: 'Amber Table Lamp photo',
  },
  {
    name: 'Table Lamp Gold',
    category: 'Bedroom',
    price: 28,
    originalPrice: 56,
    colors: [GOLD],
    newArrival: true,
    discountLabel: '-50%',
    sku: 'LC-1302',
    measurements: '7 × 7 × 15 "',
    description: 'A brushed gold table lamp with a linen shade, equally at home on a desk or a bedside table.',
    imageLabel: 'Table Lamp Gold photo',
  },
  {
    name: 'White Drawer Unit',
    category: 'Bedroom',
    price: 89,
    colors: [WHITE],
    sku: 'LC-1401',
    measurements: '30 × 16 × 28 "',
    description: 'A three-drawer storage unit finished in soft matte white, sized for a bedroom corner or entryway.',
    imageLabel: 'White Drawer Unit photo',
  },
  {
    name: 'Light Beige Pillow',
    category: 'Bedroom',
    price: 5.99,
    colors: [BEIGE],
    sku: 'LC-1304',
    measurements: '18 × 18 "',
    description: 'A soft woven throw pillow in light beige, an easy way to layer texture onto a bed or sofa.',
    imageLabel: 'Light Beige Pillow photo',
  },
  {
    name: 'Woven Rattan Basket',
    category: 'Kitchen',
    price: 28,
    colors: [BEIGE],
    sku: 'LC-1501',
    measurements: '14 × 14 × 12 "',
    description: 'A hand-woven rattan basket for pantry storage, produce, or gathering odds and ends around the kitchen.',
    imageLabel: 'Woven Rattan Basket photo',
  },
  {
    name: 'Bamboo Basket',
    category: 'Kitchen',
    price: 8.8,
    colors: [BEIGE],
    newArrival: true,
    discountLabel: '-90%',
    sku: 'LC-1502',
    measurements: '10 × 10 × 6 "',
    description: 'A small bamboo basket for countertop storage, sized for fruit, bread, or kitchen linens.',
    imageLabel: 'Bamboo Basket photo',
  },
  {
    name: 'Ceramic Teapot',
    category: 'Kitchen',
    price: 45,
    colors: [WHITE, BLACK],
    sku: 'LC-1503',
    measurements: '8 × 5 × 6 "',
    description: 'A glazed ceramic teapot with a comfortable handle and fine-mesh infuser, made for everyday brewing.',
    imageLabel: 'Ceramic Teapot photo',
  },
  {
    name: 'Bath Towel Set',
    category: 'Bathroom',
    price: 24,
    colors: [WHITE, GRAY],
    newArrival: true,
    sku: 'LC-1701',
    measurements: '30 × 56 "',
    description: 'A set of two combed-cotton bath towels, plush and quick-drying for daily use.',
    imageLabel: 'Bath Towel Set photo',
  },
  {
    name: 'Woven Table Runner',
    category: 'Dining',
    price: 22,
    colors: [BEIGE, GRAY],
    sku: 'LC-1702',
    measurements: '14 × 72 "',
    description: 'A textured woven table runner that dresses up a dining table for everyday meals or entertaining.',
    imageLabel: 'Woven Table Runner photo',
  },
  {
    name: 'Rattan Outdoor Chair',
    category: 'Outdoor',
    price: 129,
    colors: [BEIGE, BLACK],
    newArrival: true,
    sku: 'LC-1601',
    measurements: '24 × 26 × 30 "',
    description: 'A weather-resistant rattan chair with a powder-coated frame, built for the patio or a covered porch.',
    imageLabel: 'Rattan Outdoor Chair photo',
  },
];

function buildSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function seed() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error('MONGO_URL არ არის მითითებული .env ფაილში');
  }

  await mongoose.connect(mongoUrl);
  console.log('დაკავშირებულია MongoDB-სთან');

  const ProductModel = mongoose.model(Product.name, ProductSchema);
  const UserModel = mongoose.model(User.name, UserSchema);

  await ProductModel.deleteMany({});
  await ProductModel.insertMany(
    products.map((p) => ({ ...p, slug: buildSlug(p.name) })),
  );
  console.log(`${products.length} პროდუქტი დაემატა`);

  const adminEmail = 'admin@loamandco.com';
  const existingAdmin = await UserModel.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin1234', 10);
    await UserModel.create({
      firstName: 'Loam',
      lastName: 'Admin',
      email: adminEmail,
      passwordHash,
      displayName: 'Loam Admin',
      isAdmin: true,
    });
    console.log(`ადმინისტრატორი შეიქმნა: ${adminEmail} / Admin1234`);
  } else {
    console.log('ადმინისტრატორი უკვე არსებობს, გამოტოვება');
  }

  await mongoose.disconnect();
  console.log('სიდი დასრულებულია');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
