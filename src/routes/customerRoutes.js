
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { getCustomerDashboard } from "../controllers/customerController.js";

const router = express.Router();

// Every route requires an authenticated Customer.
router.use(requireAuth, requireRole("Customer"));

router.get("/dashboard", getCustomerDashboard);

export default router;
