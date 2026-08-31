import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Product, ProductSchema } from './products/schemas/product.schema';
import { Blog, BlogSchema } from './blogs/schemas/blog.schema';
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

const blogPosts = [
  {
    title: '7 ways to decor your home like a professional',
    excerpt: 'Small, deliberate changes that make a living room feel designed instead of decorated.',
    content:
      'Professional decorators rarely rely on expensive pieces alone — it is the small, deliberate choices that make a room feel finished. Start by editing before you add: clear surfaces of anything that does not serve a purpose or bring you joy. Layer lighting at three heights (floor, table, ceiling) instead of relying on one overhead fixture. Group objects in odd numbers, vary their heights, and let a few larger pieces anchor the room instead of scattering many small ones. Finally, bring in something alive — a plant, fresh flowers, or natural wood grain — to keep the space from feeling staged.',
    image: '/images/hero-living-room.webp',
    featured: true,
  },
  {
    title: 'Inside a beautiful kitchen organization',
    excerpt: 'How to keep an open kitchen looking calm even when it is in daily use.',
    content:
      'An open kitchen is judged the moment guests walk in, which makes daily-use clutter the biggest design risk in the house. The fix is not more storage — it is fewer categories on display. Keep countertops to the essentials you use every single day, and give everything else a dedicated home behind a door. Uniform containers for dry goods, a single tray for oils and utensils near the stove, and closed cabinets for small appliances go a long way. If you cook often, build your organization around your actual workflow rather than a Pinterest ideal — the system only works if it is easier than leaving things out.',
    image: '/images/category-kitchen.jpg',
    featured: false,
  },
  {
    title: 'Decor your bedroom for your children',
    excerpt: "Playful, low-maintenance ideas for a kid's room that still feels put together.",
    content:
      "A children's room has to survive daily play, which means the decor decisions that matter most are the durable ones: washable paint finishes, rugs that hide stains, and furniture with rounded edges. Beyond that, let personality come through in things that are easy to change later — art on the walls, a gallery of their own drawings, colorful storage bins — rather than in fixed elements like wallpaper or built-ins that are expensive to update as tastes change. A low shelf they can reach themselves does more for a tidy room than any amount of adult-height storage.",
    image: '/images/category-bedroom.jpg',
    featured: false,
  },
  {
    title: 'Modern home is beautiful and kid-friendly',
    excerpt: 'Balancing clean modern lines with furniture that can survive a busy household.',
    content:
      'Modern design and family life are not natural enemies — they just require choosing materials for how they age, not just how they look on day one. Performance fabrics that resist stains, engineered wood floors that shrug off scooters, and furniture with no sharp corners all keep clean lines intact without babying every surface. Keep the modern palette (neutral tones, a few bold accents, minimal ornamentation) and let texture — a chunky knit throw, a woven rug — do the work of making the space feel warm instead of clinical.',
    image: '/images/category-living-room.jpg',
    featured: true,
  },
  {
    title: 'Warm lighting changes everything',
    excerpt: 'A short guide to layering lamps and fixtures for a room that feels lived-in.',
    content:
      'A single ceiling fixture flattens a room; layered lighting gives it depth at any hour. Aim for at least three light sources at different heights — a floor lamp, a table lamp, and one accent source like a picture light or string lights — each on its own switch or dimmer if possible. Choose warm-white bulbs (around 2700K) over cool daylight tones for living spaces, since warm light is what makes a room read as cozy rather than clinical after sunset. Position lamps to pool light where you actually sit and read, not just where an outlet happens to be.',
    image: '/images/promo-banner.jpg',
    featured: false,
  },
  {
    title: 'Styling a cozy home corner',
    excerpt: 'Turning an unused wall into a corner you actually want to sit in.',
    content:
      "Every home has one: the awkward corner that becomes a dumping ground because nothing was ever planned for it. The fix is usually smaller than people expect — a single comfortable chair, a side table within reach, and a lamp are enough to turn dead space into somewhere you actually want to sit. Add a plant or a piece of art at eye level to give the corner a focal point, and resist the urge to fill it with more than one seat; a corner designed for one person to read or drink coffee gets used far more often than one designed to impress.",
    image: '/images/cozy-home-corner.jpg',
    featured: false,
  },
];

function buildSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getSeedAdminConfig() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email && !password) {
    return null;
  }

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be provided together');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('SEED_ADMIN_EMAIL must be a valid email address');
  }

  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must contain at least 12 characters');
  }

  return {
    email,
    password,
    firstName: process.env.SEED_ADMIN_FIRST_NAME?.trim() || 'Store',
    lastName: process.env.SEED_ADMIN_LAST_NAME?.trim() || 'Admin',
  };
}

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database seeding is disabled in production');
  }

  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error('MONGO_URL არ არის მითითებული .env ფაილში');
  }

  const adminConfig = getSeedAdminConfig();

  await mongoose.connect(mongoUrl);
  console.log('დაკავშირებულია MongoDB-სთან');

  const ProductModel = mongoose.model(Product.name, ProductSchema);
  const BlogModel = mongoose.model(Blog.name, BlogSchema);
  const UserModel = mongoose.model(User.name, UserSchema);

  const existingAdminUser = adminConfig
    ? await UserModel.findOne({ email: adminConfig.email })
    : null;
  if (existingAdminUser && !existingAdminUser.isAdmin) {
    throw new Error('SEED_ADMIN_EMAIL belongs to a non-admin account');
  }

  await ProductModel.deleteMany({});
  await ProductModel.insertMany(
    products.map((p) => ({ ...p, slug: buildSlug(p.name) })),
  );
  console.log(`${products.length} პროდუქტი დაემატა`);

  await BlogModel.deleteMany({});
  await BlogModel.insertMany(
    blogPosts.map((b) => ({ ...b, slug: buildSlug(b.title) })),
  );
  console.log(`${blogPosts.length} ბლოგპოსტი დაემატა`);

  if (!adminConfig) {
    console.log('ადმინისტრატორის შექმნა გამოტოვებულია');
  } else if (existingAdminUser) {
    console.log('ადმინისტრატორი უკვე არსებობს, გამოტოვება');
  } else {
    const passwordHash = await bcrypt.hash(adminConfig.password, 12);
    await UserModel.create({
      firstName: adminConfig.firstName,
      lastName: adminConfig.lastName,
      email: adminConfig.email,
      passwordHash,
      displayName: `${adminConfig.firstName} ${adminConfig.lastName}`,
      isAdmin: true,
    });
    console.log(`ადმინისტრატორი შეიქმნა: ${adminConfig.email}`);
  }

  await mongoose.disconnect();
  console.log('სიდი დასრულებულია');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
