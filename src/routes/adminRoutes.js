
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

import {
  getAllServices,
  updateServiceApproval,
  deleteRejectedService,
  updateAdminServiceAvailability,
  getAllUsers,
  updateUserStatus,
  getAllTransactions,
  getAdminOverview,
} from "../controllers/adminController.js";

const router = express.Router();

// Every route requires an authenticated Admin.
router.use(requireAuth, requireRole("Admin"));

// Manage Services
router.get("/services", getAllServices);
router.patch("/services/:id/approval", updateServiceApproval);
router.delete("/services/:id", deleteRejectedService);
router.patch(
  "/services/:id/availability",
  updateAdminServiceAvailability
);

// Manage Users
router.get("/users", getAllUsers);
router.patch("/users/:id/status", updateUserStatus);

// Manage Transactions
router.get("/transactions", getAllTransactions);

// Admin Overview
router.get("/overview", getAdminOverview);


export default router;
