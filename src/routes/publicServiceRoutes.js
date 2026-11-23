import express from "express";
import { getFeaturedServices, getPublicServices, } from "../controllers/serviceController.js";

const router = express.Router();

router.get("/featured", getFeaturedServices);
router.get("/", getPublicServices);

export default router;