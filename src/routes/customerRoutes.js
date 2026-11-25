
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

import {
  getCustomerDashboard,
  getCustomerProfile,
  updateCustomerProfile,
} from "../controllers/customerController.js";

const router = express.Router();

// Every route requires an authenticated Customer.
router.use(requireAuth, requireRole("Customer"));

router.get("/dashboard", getCustomerDashboard);
router.get("/profile", getCustomerProfile);
router.patch("/profile", updateCustomerProfile);

export default router;
