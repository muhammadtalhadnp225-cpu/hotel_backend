import { Router } from 'express';
import {
  getGuestServicesOverview,
  getGuestServiceRequests,
  createGuestServiceRequest,
  updateGuestServiceStatus,
  deleteGuestServiceRequest,
} from '../controllers/guestServiceController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Public services catalog endpoint for website / booking add-ons
export const PUBLIC_SERVICES = [
  {
    id: "srv-transfer",
    name: "VIP Private Airport Transfer",
    category: "Transfer",
    price: 150,
    priceType: "per_stay",
    icon: "Car",
    description: "Chauffeur-driven luxury sedan transfer to and from the airport with private lounge check-in.",
    popular: true
  },
  {
    id: "srv-breakfast",
    name: "In-Suite Champagne Breakfast",
    category: "Dining",
    price: 85,
    priceType: "per_person",
    icon: "Coffee",
    description: "Gourmet multi-course breakfast with vintage champagne served on your private balcony.",
    popular: true
  },
  {
    id: "srv-spa",
    name: "Royal Hydrotherapy Spa Session",
    category: "Wellness",
    price: 220,
    priceType: "per_person",
    icon: "Sparkles",
    description: "90-minute signature thermal bath therapy, aromatherapy massage, and herbal sauna pass.",
    popular: true
  },
  {
    id: "srv-butler",
    name: "Dedicated Majordomo Service",
    category: "In-Suite",
    price: 300,
    priceType: "per_night",
    icon: "Crown",
    description: "24/7 personal butler for unpacking, wardrobe pressing, reservations, and custom itinerary planning.",
    popular: false
  },
  {
    id: "srv-yacht",
    name: "Sunset Yacht Excursion",
    category: "Experience",
    price: 650,
    priceType: "per_stay",
    icon: "Ship",
    description: "Private 3-hour sunset cruise with sommelier wine tasting and seafood canapés.",
    popular: true
  }
];

router.get('/', (req, res) => {
  res.json({
    success: true,
    count: PUBLIC_SERVICES.length,
    data: PUBLIC_SERVICES
  });
});

// Protected routes for in-stay guest service requests
router.use(authenticate);

router.get('/overview', getGuestServicesOverview);
router.get('/requests', getGuestServiceRequests);
router.post('/requests', createGuestServiceRequest);
router.patch('/requests/:id/status', updateGuestServiceStatus);
router.put('/requests/:id', updateGuestServiceStatus);
router.delete('/requests/:id', deleteGuestServiceRequest);

export default router;
