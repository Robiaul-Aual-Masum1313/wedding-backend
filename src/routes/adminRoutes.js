
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

// Every route in this router requires a valid Admin JWT.
router.use(requireAuth, requireRole("Admin"));

router.get("/dashboard", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the Admin dashboard!",
    user: req.user,
  });
});

export default router;
