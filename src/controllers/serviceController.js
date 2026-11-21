
import { getDB } from "../config/db.js";

const allowedCategories = [
  "Photography",
  "Venue",
  "Catering",
  "Decoration",
  "Music",
  "Makeup",
];

export const createService = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      images,
      price,
      location,
    } = req.body;

    // Validate required fields
    if (
      !title?.trim() ||
      !category ||
      !description?.trim() ||
      !Array.isArray(images) ||
      images.length === 0 ||
      !location?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required service information.",
      });
    }

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service category.",
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a number greater than zero.",
      });
    }

    if (
      !images.every(
        (image) =>
          typeof image === "string" &&
          /^https:\/\/.+/i.test(image)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid HTTPS image URLs.",
      });
    }

    const db = getDB();

    // Always use the authenticated vendor ID
    const vendorId = req.user.id;

    // Read the vendor's actual subscription from Better Auth
    const vendor = await db.collection("user").findOne(
      { id: vendorId },
      { projection: { subscriptionPlan: 1, isBlocked: 1 } }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor account not found.",
      });
    }

    if (vendor.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked.",
      });
    }

    const subscriptionPlan = vendor.subscriptionPlan || "Free";

    // Free vendors can have a maximum of 3 active services
    if (subscriptionPlan !== "Premium") {
      const activeServiceCount = await db
        .collection("services")
        .countDocuments({
          vendorId,
          isActive: true,
        });

      if (activeServiceCount >= 3) {
        return res.status(403).json({
          success: false,
          message:
            "Free vendors can have up to 3 active services. Upgrade to Premium to add more.",
        });
      }
    }

    const now = new Date();

    const newService = {
      vendorId,
      title: title.trim(),
      category,
      description: description.trim(),
      images,
      price: numericPrice,
      location: location.trim(),

      // Vendor submissions always need admin approval
      approvalStatus: "Pending",
      isActive: true,

      createdAt: now,
      updatedAt: now,
    };

    const result = await db
      .collection("services")
      .insertOne(newService);

    return res.status(201).json({
      success: true,
      message: "Service submitted for admin approval.",
      service: {
        ...newService,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Create service error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create service.",
    });
  }
};
