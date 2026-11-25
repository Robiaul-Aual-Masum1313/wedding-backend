
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

export const getVendorDashboard = async (req, res) => {
  try {
    const db = getDB();

    // Get the authenticated vendor's ID.
    const vendorId = req.user.id;

    const servicesCollection = db.collection("services");
    const bookingsCollection = db.collection("bookings");

    // Fetch all dashboard statistics concurrently.
    const [
      totalServices,
      activeServices,
      totalBookings,
      pendingBookings,
    ] = await Promise.all([
      servicesCollection.countDocuments({ vendorId }),

      servicesCollection.countDocuments({
        vendorId,
        isActive: true,
      }),

      bookingsCollection.countDocuments({ vendorId }),

      bookingsCollection.countDocuments({
        vendorId,
        status: "Pending",
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Vendor dashboard data retrieved successfully.",

      user: req.user,

      stats: {
        totalServices,
        activeServices,
        totalBookings,
        pendingBookings,
      },
    });
  } catch (error) {
    console.error("Vendor dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load vendor dashboard.",
    });
  }
};


//code for vendor profile page settings

// GET Vendor Profile
export const getVendorProfile = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("user");

    const vendorId = req.user.id;

    // Support both string IDs and MongoDB ObjectIds.
    const userIdConditions = [
      { id: vendorId },
      { _id: vendorId },
    ];

    if (ObjectId.isValid(vendorId)) {
      userIdConditions.push({
        _id: new ObjectId(vendorId),
      });
    }

    // Find only the authenticated vendor.
    const vendor = await usersCollection.findOne(
      {
        $or: userIdConditions,
        role: "Vendor",
      },
      {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          email: 1,
          image: 1,
          phone: 1,
          location: 1,
          businessName: 1,
          website: 1,
          bio: 1,
          role: 1,
          subscriptionPlan: 1,
          subscriptionExpiresAt: 1,
          createdAt: 1,
        },
      }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vendor profile retrieved successfully.",
      profile: {
        name: vendor.name || "",
        email: vendor.email || "",
        image: vendor.image || "",
        phone: vendor.phone || "",
        location: vendor.location || "",
        businessName: vendor.businessName || "",
        website: vendor.website || "",
        bio: vendor.bio || "",
        role: vendor.role,
        subscriptionPlan: vendor.subscriptionPlan || "Free",
        subscriptionExpiresAt: vendor.subscriptionExpiresAt || null,
        createdAt: vendor.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Vendor profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve vendor profile.",
    });
  }
};

//code for  update vendor profile settings update

// PATCH Vendor Profile
export const updateVendorProfile = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("user");

    // Only accept the fields vendors are allowed to update.
    const {
      name,
      phone,
      location,
      businessName,
      website,
      bio,
      image,
    } = req.body || {};

    // Validate required fields.
    if (
      typeof name !== "string" ||
      typeof phone !== "string" ||
      typeof location !== "string" ||
      typeof businessName !== "string" ||
      typeof website !== "string" ||
      typeof bio !== "string" ||
      typeof image !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid profile information.",
      });
    }

    // Remove unnecessary whitespace.
    const updatedProfile = {
      name: name.trim(),
      phone: phone.trim(),
      location: location.trim(),
      businessName: businessName.trim(),
      website: website.trim(),
      bio: bio.trim(),
      image: image.trim(),
    };

    // Required field validation.
    if (
      !updatedProfile.name ||
      !updatedProfile.phone ||
      !updatedProfile.location ||
      !updatedProfile.businessName
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields.",
      });
    }

    // Length validation.
    if (
      updatedProfile.name.length > 100 ||
      updatedProfile.phone.length > 20 ||
      updatedProfile.location.length > 150 ||
      updatedProfile.businessName.length > 150 ||
      updatedProfile.website.length > 200 ||
      updatedProfile.bio.length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more profile fields exceed the allowed length.",
      });
    }

    // Phone number validation.
    if (!/^[+()\d\s-]{7,20}$/.test(updatedProfile.phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number.",
      });
    }

    // Website validation: allow an empty value or a valid HTTP(S) URL.
    if (updatedProfile.website) {
      try {
        const websiteUrl = new URL(updatedProfile.website);

        if (!["http:", "https:"].includes(websiteUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid website URL.",
        });
      }
    }

    // Profile image must be an HTTPS URL or an empty string.
    if (
      updatedProfile.image &&
      !updatedProfile.image.startsWith("https://")
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid profile image URL.",
      });
    }

    // Get the authenticated vendor's ID.
    const vendorId = req.user.id;

    // Support both string IDs and MongoDB ObjectIds.
    const userIdConditions = [
      { id: vendorId },
      { _id: vendorId },
    ];

    if (ObjectId.isValid(vendorId)) {
      userIdConditions.push({
        _id: new ObjectId(vendorId),
      });
    }

    // Update only the authenticated vendor's allowed fields.
    const updateResult = await usersCollection.updateOne(
      {
        $or: userIdConditions,
        role: "Vendor",
      },
      {
        $set: {
          ...updatedProfile,
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found.",
      });
    }

    // Retrieve the updated profile.
    const vendor = await usersCollection.findOne(
      {
        $or: userIdConditions,
        role: "Vendor",
      },
      {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          email: 1,
          image: 1,
          phone: 1,
          location: 1,
          businessName: 1,
          website: 1,
          bio: 1,
          role: 1,
          subscriptionPlan: 1,
          subscriptionExpiresAt: 1,
          createdAt: 1,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Vendor profile updated successfully.",
      profile: {
        name: vendor.name || "",
        email: vendor.email || "",
        image: vendor.image || "",
        phone: vendor.phone || "",
        location: vendor.location || "",
        businessName: vendor.businessName || "",
        website: vendor.website || "",
        bio: vendor.bio || "",
        role: vendor.role,
        subscriptionPlan: vendor.subscriptionPlan || "Free",
        subscriptionExpiresAt: vendor.subscriptionExpiresAt || null,
        createdAt: vendor.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Update vendor profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update vendor profile.",
    });
  }
};