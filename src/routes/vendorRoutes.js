
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

// Every route in this router requires a valid Vendor JWT.
router.use(requireAuth, requireRole("Vendor"));

router.get("/dashboard", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to your Vendor dashboard!",
    user: req.user,
  });
});

export default router;
