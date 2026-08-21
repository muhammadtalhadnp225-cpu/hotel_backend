import { Router } from 'express';
import {
  getDashboardAnalytics,
  getStaffList,
  updateStaff,
  deleteStaff,
  getAuditLogs,
  clearAllData,
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';
import { Review } from '../models/Review.js';
import { getOrSeedReviews } from './publicWebsiteRoutes.js';

const router = Router();

// Protect all admin routes - allow admin, manager, receptionist, staff
router.use(protect);
router.use(authorize('admin', 'manager', 'receptionist', 'staff', 'employee'));

router.get('/analytics', getDashboardAnalytics);
router.get('/staff', getStaffList);
router.put('/staff/:id', authorize('admin', 'manager'), updateStaff);
router.delete('/staff/:id', authorize('admin'), deleteStaff);
router.get('/audit-logs', authorize('admin', 'manager'), getAuditLogs);
router.post('/clear-all-data', authorize('admin'), clearAllData);
router.delete('/clear-all-data', authorize('admin'), clearAllData);

// Reviews & Guest Experiences Endpoints in Admin / Staff Panel
router.get('/reviews', async (req, res) => {
  try {
    await getOrSeedReviews();
    const { status, rating, search } = req.query;
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
        { roomStayed: q },
      ];
    }

    const reviews = await Review.find(filter).sort({ status: 1, updatedAt: -1, createdAt: -1 }).lean();
    const allReviews = await Review.find({}).lean();
    const totalCount = allReviews.length;
    const avgRating = totalCount > 0 ? (allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalCount).toFixed(2) : '5.00';
    const fiveStarCount = allReviews.filter((r: any) => r.rating === 5).length;
    const featuredCount = allReviews.filter((r: any) => r.status === 'featured').length;
    const publishedCount = allReviews.filter((r: any) => r.status === 'published' || r.status === 'featured').length;

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
      reviews,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reviews/set-website-display', async (req, res) => {
  try {
    const { reviewIds } = req.body;
    if (!Array.isArray(reviewIds)) {
      res.status(400).json({ success: false, message: 'reviewIds array is required' });
      return;
    }
    const targetIds = reviewIds.slice(0, 3);
    await Review.updateMany({ _id: { $nin: targetIds }, status: 'featured' }, { $set: { status: 'published' } });
    if (targetIds.length > 0) {
      await Review.updateMany({ _id: { $in: targetIds } }, { $set: { status: 'featured', updatedAt: new Date() } });
    }

    const updatedFeatured = await Review.find({ _id: { $in: targetIds } }).lean();
    res.json({
      success: true,
      message: `Selected ${updatedFeatured.length} experiences to showcase on the public website.`,
      featured: updatedFeatured,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/reviews/:id', async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/reviews/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Review.findByIdAndUpdate(req.params.id, { status, updatedAt: new Date() }, { new: true });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
