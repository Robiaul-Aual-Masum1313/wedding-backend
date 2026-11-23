
import express from "express";

import {
  getFeaturedServices,
  getPublicServices,
  getServiceById,
} from "../controllers/serviceController.js";

import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

router.get("/featured", getFeaturedServices);
router.get("/", getPublicServices);

// Authentication required for service details
// router.get("/:id", requireAuth, getServiceById);
router.get("/details/:id", requireAuth, getServiceById);

export default router;
