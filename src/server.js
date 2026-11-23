import "dotenv/config";

import express from "express";
import cors from "cors";

import { toNodeHandler } from "better-auth/node";

import { connectDB } from "./config/db.js";
import { createAuth } from "./lib/auth.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import publicServiceRoutes from "./routes/publicServiceRoutes.js";

const app = express();

const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

// Start application
const startServer = async () => {
  try {
    // Connect MongoDB first
    await connectDB();

    // Initialize Better Auth after database connection
    const auth = createAuth();

    // Make the auth instance available to middleware.
    app.locals.auth = auth;

    // Better Auth handler
    // Express 5 syntax
    app.all("/api/auth/*splat", toNodeHandler(auth));

    // Body parser for other API routes
    app.use(express.json());

    // Public API routes
    app.use("/api/services", publicServiceRoutes);
    app.use("/api/services", serviceRoutes);

    // Protected API routes
    app.use("/api/vendor", vendorRoutes);
    app.use("/api/uploads", uploadRoutes);
    app.use("/api/services", serviceRoutes);
    app.use("/api/customer", customerRoutes);
    app.use("/api/admin", adminRoutes);
    // Health check
    app.get("/", (req, res) => {
      res.status(200).json({
        success: true,
        message: "Welcome to WedPlan API!",
      });
    });

    app.listen(PORT, () => {
      console.log(`WedPlan server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
