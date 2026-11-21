
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

// Every route in this router requires a valid Customer JWT.
router.use(requireAuth, requireRole("Customer"));

router.get("/dashboard", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to your Customer dashboard!",
    user: req.user,
  });
});

export default router;
