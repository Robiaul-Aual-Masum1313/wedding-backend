
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { getAllServices , updateServiceApproval,
  deleteRejectedService,
  updateAdminServiceAvailability, } from "../controllers/adminController.js";

const router = express.Router();

// Every route requires an authenticated Admin.
router.use(requireAuth, requireRole("Admin"));

router.get("/services", getAllServices);
router.patch("/services/:id/approval", updateServiceApproval);
router.delete("/services/:id", deleteRejectedService);
router.patch(
  "/services/:id/availability",
  updateAdminServiceAvailability
);

export default router;
