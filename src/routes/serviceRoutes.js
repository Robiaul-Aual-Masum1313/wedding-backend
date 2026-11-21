
import express from "express";
import { createService } from "../controllers/serviceController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

// Every route below requires an authenticated Vendor
router.use(requireAuth, requireRole("Vendor"));

router.post("/", createService);

export default router;
