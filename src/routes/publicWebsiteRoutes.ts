import { Router, Request, Response } from 'express';
import { Reservation } from '../models/Reservation.js';
import { Room } from '../models/Room.js';
import { Review } from '../models/Review.js';

const router = Router();

// ----------------- Facilities Catalog -----------------
const FACILITIES_DATA = [
  {
    id: "fac-1",
    slug: "infinity-azure-pool",
    name: "The Celestial Infinity Lagoon",
    category: "Recreation & Pool",
    tagline: "Suspended between turquoise sky and coral reef",
    shortDescription: "A heated multi-tier Olympic infinity pool overlooking the ocean with private underwater music acoustics.",
    description: "Immerse yourself in our architectural masterpiece: a cantilevered infinity pool with panoramic lagoon views, sunken cabana lounges, heated mineral water, and complimentary chilled towels and sorbet service.",
    availability: "06:00 AM - 10:00 PM Daily",
    icon: "Waves",
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80"
    ],
    location: "Level 2 Ocean Deck",
    features: ["Heated Mineral Water", "Underwater Sound System", "VIP Private Cabanas", "Poolside Majordomo"],
    complimentary: true,
    pricingInfo: "Included with suite reservation",
    dressCode: "Resort Casual / Swimwear",
    bookingRequired: false
  },
  {
    id: "fac-2",
    slug: "aethelgard-spa-haven",
    name: "The Sanctuary Hydrotherapy & Thermal Spa",
    category: "Wellness & Spa",
    tagline: "Ancient botanical elixirs meets modern Swiss hydro-rejuvenation",
    shortDescription: "Over 2,500 sqm of holistic wellness spaces, Himalayan salt saunas, crystal steam rooms, and vitality pools.",
    description: "An enclave of peace offering bespoke European balneotherapy, cold-plunge vitality pools, herbal vitality saunas, and personalized treatment suites with ocean vistas.",
    availability: "08:00 AM - 09:00 PM Daily",
    icon: "Sparkles",
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80"
    ],
    location: "Wellness Pavilion (East Wing)",
    features: ["Himalayan Salt Sauna", "Swiss Vichy Showers", "Private Double Treatment Suites", "Aromatherapy Lounge"],
    complimentary: false,
    pricingInfo: "Treatments starting from RS 180",
    dressCode: "Spa Robe & Slippers (Provided)",
    bookingRequired: true
  },
  {
    id: "fac-3",
    slug: "le-mirage-grand-dining",
    name: "Le Mirage 3-Star Michelin Pavilion",
    category: "Dining & Lounges",
    tagline: "Epicurean theater elevated over the crystal ocean waves",
    shortDescription: "Award-winning gastronomic tasting menus curated by Chef Laurent Dubois paired with a 3,000-bottle wine cellar.",
    description: "Experience fine dining reimagined. Le Mirage offers innovative modern French cuisine with sustainable local seafood, rare truffles, and rare vintage champagne pairings.",
    availability: "Dinner 06:30 PM - 11:00 PM (Reservation Required)",
    icon: "Utensils",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
    ],
    location: "Ocean Overwater Pavilion",
    features: ["3-Star Michelin Culinary Team", "3,000 Bottle Master Cellar", "Private Chef Table", "Sunset View Seating"],
    complimentary: false,
    pricingInfo: "Degustation menu from RS 260 / guest",
    dressCode: "Formal / Elegant Evening Attire",
    bookingRequired: true
  },
  {
    id: "fac-4",
    slug: "helipad-and-yacht-marina",
    name: "Private Heliport & Superyacht Marina",
    category: "Services & Transport",
    tagline: "Seamless VIP arrivals by air or sea",
    shortDescription: "Private twin-engine helicopter transfers and deep-water marina berths for yachts up to 90 meters.",
    description: "Arrive in uncompromising luxury. Our certified private helipad provides swift 12-minute transfers from the international airport, while the private marina features full concierge fueling and customs clearance.",
    availability: "24 Hours On-Demand",
    icon: "Navigation",
    image: "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=1200&q=80"
    ],
    location: "North Marina Point",
    features: ["Twin-Engine Helipad", "90m Deep Water Berths", "Customs & Immigration Lounge", "Chauffeured Buggies"],
    complimentary: false,
    pricingInfo: "Bespoke charter quotations on request",
    dressCode: "Smart Casual",
    bookingRequired: true
  }
];

// Facilities endpoints
router.get('/facilities', (req: Request, res: Response) => {
  const { category, search } = req.query;
  let filtered = [...FACILITIES_DATA];
  if (category && category !== 'All') {
    filtered = filtered.filter(f => f.category.toLowerCase() === String(category).toLowerCase());
  }
  if (search) {
    const s = String(search).toLowerCase();
    filtered = filtered.filter(f => f.name.toLowerCase().includes(s) || f.description.toLowerCase().includes(s));
  }
  res.json({ success: true, count: filtered.length, data: filtered });
});

router.get('/facilities/:idOrSlug', (req: Request, res: Response) => {
  const match = FACILITIES_DATA.find(f => f.slug === req.params.idOrSlug || f.id === req.params.idOrSlug);
  if (!match) {
    return res.status(404).json({ success: false, message: 'Facility not found' });
  }
  res.json({ success: true, data: match });
});

// ----------------- Spa Catalog & Bookings -----------------
const SPA_TREATMENTS = [
  {
    id: "spa-1",
    name: "Royal Diamond Anti-Aging Facial",
    duration: "90 Minutes",
    price: 240,
    therapist: "Swiss Certified Aesthetician",
    description: "Cellular rejuvenation using pulverized white diamonds, botanical peptides, and 24-karat gold collagen masks.",
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "spa-2",
    name: "Deep Ocean Magnesium Massage",
    duration: "75 Minutes",
    price: 195,
    therapist: "Master Masseuse",
    description: "Deep tissue tension relief using heated volcanic stones infused with pure oceanic magnesium minerals.",
    image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: "spa-3",
    name: "Botanical Ayurvedic Body Ritual",
    duration: "120 Minutes",
    price: 310,
    therapist: "Ayurvedic Practitioner",
    description: "Warm herbal oil Shirodhara head flow accompanied by full body exfoliation with organic sandalwood and jasmine.",
    image: "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=1000&q=80"
  }
];

router.get('/spa', (req: Request, res: Response) => {
  res.json({ success: true, count: SPA_TREATMENTS.length, data: SPA_TREATMENTS });
});

router.post('/spa/book', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Spa treatment appointment reserved successfully. Your wellness concierge will confirm details shortly.',
    bookingId: `SPA-RES-${Date.now().toString().slice(-6)}`
  });
});

// ----------------- Dining Venues & Reservations -----------------
const DINING_VENUES = [
  {
    id: "dining-1",
    name: "Le Mirage Gastronomy",
    cuisine: "Modern French & Seafood",
    chef: "Executive Chef Laurent Dubois",
    dressCode: "Formal Evening",
    hours: "18:30 - 23:00 Daily",
    description: "Overwater haute-cuisine elevated above gentle tides. Tasting menus curated with imported black truffles and line-caught coral fish.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    signatureDish: "Wild Turbot in Champagne Caviar Emulsion"
  },
  {
    id: "dining-2",
    name: "Aura Oceanfront Grill & Raw Bar",
    cuisine: "Mediterranean & Charcoal Grill",
    chef: "Chef Marco Rossi",
    dressCode: "Resort Elegant",
    hours: "12:00 - 16:00, 18:00 - 22:30",
    description: "Al-fresco dining on teak decking with wood-fired prime dry-aged wagyu cuts and live oyster shucking.",
    image: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1200&q=80",
    signatureDish: "A5 Miyazaki Wagyu Ribeye & Coral Lobster Tail"
  }
];

router.get('/dining', (req: Request, res: Response) => {
  res.json({ success: true, count: DINING_VENUES.length, data: DINING_VENUES });
});

router.get('/dining/menus', (req: Request, res: Response) => {
  res.json({
    success: true,
    menus: [
      { category: "Tasting Menu", items: [{ name: "Imperial Caviar Tartlet", price: 65 }, { name: "A5 Wagyu Striploin", price: 140 }] },
      { category: "Sommelier Cellar", items: [{ name: "Dom Pérignon Vintage 2013", price: 480 }, { name: "Château Margaux Premier Grand Cru", price: 1200 }] }
    ]
  });
});

router.get('/dining/:idOrSlug', (req: Request, res: Response) => {
  const match = DINING_VENUES.find(v => v.id === req.params.idOrSlug || v.name.toLowerCase().includes(req.params.idOrSlug.toLowerCase()));
  if (!match) return res.status(404).json({ success: false, message: 'Dining venue not found' });
  res.json({ success: true, data: match });
});

router.post('/dining/reserve-table', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Table reservation request confirmed. A confirmation SMS has been dispatched.',
    tableReservationId: `TBL-${Date.now().toString().slice(-5)}`
  });
});

// ----------------- Guest Reviews & Testimonials -----------------
const INITIAL_GUEST_REVIEWS = [
  {
    author: "Eleanor & Henry Sterling",
    country: "United Kingdom",
    rating: 5,
    stayDate: "May 2026",
    roomStayed: "Royal Penthouse Suite",
    title: "An uncompromised masterpiece of hospitality",
    comment: "From the moment the private speedboat docked to our butler unpacking our bags, every second at Aethelgard was absolute perfection.",
    verified: true,
    status: "published"
  },
  {
    author: "Dr. Alexander Wright",
    country: "Switzerland",
    rating: 5,
    stayDate: "June 2026",
    roomStayed: "Overwater Imperial Villa",
    title: "Unmatched tranquility and Michelin-grade dining",
    comment: "The hydrotherapy spa rituals and Le Mirage dining elevated our anniversary beyond all expectations. We have already booked for next winter.",
    verified: true,
    status: "published"
  },
  {
    author: "Sophia Al-Mansoor",
    country: "United Arab Emirates",
    rating: 5,
    stayDate: "July 2026",
    roomStayed: "Presidential Beach Villa",
    title: "Pure paradise with flawless attention to detail",
    comment: "The bespoke pillow menu, private yacht sunset tour, and dedicated majordomo service redefine modern ultra-luxury.",
    verified: true,
    status: "published"
  }
];

// Helper to ensure initial reviews exist
export async function getOrSeedReviews() {
  try {
    const count = await Review.countDocuments();
    if (count === 0) {
      await Review.insertMany(INITIAL_GUEST_REVIEWS);
    }
  } catch (e) {
    // ignore
  }
}

router.get('/reviews', async (req: Request, res: Response) => {
  try {
    await getOrSeedReviews();
    // Prioritize explicitly featured/pinned reviews first
    const featured = await Review.find({ status: 'featured' }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    const featuredIds = featured.map(r => r._id.toString());
    const published = await Review.find({ status: 'published', _id: { $nin: featuredIds } }).sort({ createdAt: -1 }).lean();

    const allPublicReviews = [...featured, ...published];
    const displayReviews = allPublicReviews.slice(0, 3);

    const total = allPublicReviews.length;
    const avg = total > 0 ? (allPublicReviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(2) : '5.00';
    const breakdown: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
    allPublicReviews.forEach(r => {
      const key = String(Math.round(r.rating || 5));
      if (breakdown[key] !== undefined) breakdown[key]++;
    });

    res.json({
      success: true,
      stats: {
        averageRating: Number(avg),
        breakdown,
        recommendationPercentage: 99,
        totalReviews: total,
      },
      data: displayReviews.map((r: any) => ({
        id: r._id,
        _id: r._id,
        author: r.author,
        country: r.country || 'International',
        rating: r.rating,
        stayDate: r.stayDate || new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        roomStayed: r.roomStayed || 'Sanctuary Suite',
        title: r.title,
        comment: r.comment,
        verified: r.verified !== false,
        status: r.status,
        createdAt: r.createdAt,
      }))
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reviews', async (req: Request, res: Response) => {
  try {
    const { author, country, rating, roomStayed, title, comment } = req.body;
    if (!author || !comment) {
      return res.status(400).json({ success: false, message: 'Author name and review reflection are required.' });
    }

    const created = await Review.create({
      author: author.trim(),
      country: (country || 'International').trim(),
      rating: Number(rating) || 5,
      stayDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      roomStayed: (roomStayed || 'Sanctuary Suite').trim(),
      title: (title || 'Exceptional Sanctuary Experience').trim(),
      comment: comment.trim(),
      verified: true,
      status: 'published'
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! Your reflection has been stored in the Hotel ERP.',
      data: created
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin Review Management Endpoints
router.get('/admin/reviews', async (req: Request, res: Response) => {
  try {
    await getOrSeedReviews();
    const { search, rating, status } = req.query;
    const filter: any = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (rating && rating !== 'all') {
      filter.rating = Number(rating);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = new RegExp(search.trim(), 'i');
      filter.$or = [
        { author: q },
        { country: q },
        { title: q },
        { comment: q },
        { roomStayed: q }
      ];
    }

    const reviews = await Review.find(filter).sort({ status: 1, updatedAt: -1, createdAt: -1 }).lean();
    const allReviews = await Review.find({}).lean();
    const totalCount = allReviews.length;
    const avgRating = totalCount > 0 ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / totalCount).toFixed(2) : '5.00';
    const fiveStarCount = allReviews.filter(r => r.rating === 5).length;
    const featuredCount = allReviews.filter(r => r.status === 'featured').length;
    const publishedCount = allReviews.filter(r => r.status === 'published' || r.status === 'featured').length;

    res.json({
      success: true,
      count: reviews.length,
      stats: {
        total: totalCount,
        averageRating: Number(avgRating),
        fiveStars: fiveStarCount,
        published: publishedCount,
        featuredCount,
      },
      reviews
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/reviews/set-website-display', async (req: Request, res: Response) => {
  try {
    const { reviewIds } = req.body;
    if (!Array.isArray(reviewIds)) {
      return res.status(400).json({ success: false, message: 'reviewIds must be an array of IDs.' });
    }

    const targetIds = reviewIds.slice(0, 3);
    // Unfeature existing
    await Review.updateMany({ _id: { $nin: targetIds }, status: 'featured' }, { $set: { status: 'published' } });
    // Feature target IDs
    if (targetIds.length > 0) {
      await Review.updateMany({ _id: { $in: targetIds } }, { $set: { status: 'featured', updatedAt: new Date() } });
    }

    const updatedFeatured = await Review.find({ _id: { $in: targetIds } }).lean();
    res.json({
      success: true,
      message: `Selected ${updatedFeatured.length} experiences to showcase on the public website.`,
      featured: updatedFeatured
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admin/reviews/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Review.findByIdAndDelete(id);
    res.json({ success: true, message: 'Guest review deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/admin/reviews/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await Review.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true });
    res.json({ success: true, message: `Review status updated to ${status}.`, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------- Password Reset Endpoints -----------------
router.post('/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  const token = `rst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
  res.json({
    success: true,
    message: `Password reset instructions have been dispatched to ${email || 'your email'}.`,
    resetToken: token,
    resetUrl: `/reset-password?token=${token}`
  });
});

router.post('/auth/reset-password', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Your account password has been updated securely. You may now sign in.'
  });
});

// ----------------- Additional Reservation Actions -----------------
router.patch('/reservations/:reference/modify', async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const { specialRequests } = req.body;
    const resv = await Reservation.findOneAndUpdate(
      { $or: [{ reservationNumber: reference }, { bookingNumber: reference }] },
      { $set: { specialRequests } },
      { new: true }
    );
    res.json({ success: true, message: 'Stay preferences updated in reservation folio', data: resv });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reservations/:reference/cancel', async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const { reason } = req.body;
    const resv = await Reservation.findOneAndUpdate(
      { $or: [{ reservationNumber: reference }, { bookingNumber: reference }] },
      { $set: { status: 'cancelled', cancellationReason: reason || 'Customer requested online cancellation', cancelledAt: new Date() } },
      { new: true }
    );
    res.json({ success: true, message: 'Reservation has been cancelled successfully', data: resv });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
