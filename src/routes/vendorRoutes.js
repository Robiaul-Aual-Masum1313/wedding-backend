
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { getVendorDashboard } from "../controllers/vendorController.js";

const router = express.Router();

// Every route in this router requires a valid Vendor JWT.
router.use(requireAuth, requireRole("Vendor"));

router.get("/dashboard", getVendorDashboard);

export default router;
