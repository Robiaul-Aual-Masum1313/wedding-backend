import express from "express";

import {
  createBooking,
  getMyBookings,
  cancelBooking,
  getVendorBookingRequests,
   acceptBooking,
   rejectBooking,
} from "../controllers/bookingController.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireActiveUser } from "../middleware/requireActiveUser.js";

const router = express.Router();

// Customer APIs
router.post(
  "/",
  requireAuth,
  requireActiveUser,
  requireRole("Customer"),
  createBooking
);

router.get(
  "/my-bookings",
  requireAuth,
  requireActiveUser,
  requireRole("Customer"),
  getMyBookings
);

router.patch(
  "/:id/cancel",
  requireAuth,
  requireActiveUser,
  requireRole("Customer"),
  cancelBooking
);

// Vendor APIs
router.get(
  "/vendor-requests",
  requireAuth,
  requireActiveUser,
  requireRole("Vendor"),
  getVendorBookingRequests
);

router.patch(
  "/:id/accept",
  requireAuth,
  requireActiveUser,
  requireRole("Vendor"),
  acceptBooking
);
router.patch(
  "/:id/reject",
  requireAuth,
  requireActiveUser,
  requireRole("Vendor"),
  rejectBooking
);

export default router;