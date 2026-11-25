
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { getVendorDashboard } from "../controllers/vendorController.js";
import {
  createCheckoutSession,
  getSubscriptionStatus,
} from "../controllers/subscriptionController.js";

const router = express.Router();

// Every route in this router requires a valid Vendor JWT.
router.use(requireAuth, requireRole("Vendor"));

router.get("/dashboard", getVendorDashboard);
// Stripe subscription routes.
router.post("/subscription/checkout", createCheckoutSession);
router.get("/subscription", getSubscriptionStatus);

export default router;
