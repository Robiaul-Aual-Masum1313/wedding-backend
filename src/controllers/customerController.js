
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

export const getCustomerDashboard = async (req, res) => {
  try {
    const db = getDB();

    // Get authenticated customer's ID.
    const customerId = req.user.id;

    const bookingsCollection = db.collection("bookings");

    // Fetch dashboard statistics concurrently.
    const [
      totalBookings,
      pendingBookings,
      acceptedBookings,
    ] = await Promise.all([
      bookingsCollection.countDocuments({ customerId }),

      bookingsCollection.countDocuments({
        customerId,
        status: "Pending",
      }),

      bookingsCollection.countDocuments({
        customerId,
        status: "Accepted",
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Customer dashboard data retrieved successfully.",

      user: req.user,

      stats: {
        totalBookings,
        pendingBookings,
        acceptedBookings,
      },
    });
  } catch (error) {
    console.error("Customer dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load customer dashboard.",
    });
  }
};
//code foe customer profile setting page



export const getCustomerProfile = async (req, res) => {
  try {
    const db = getDB();
    const customerId = req.user.id;

    const userIdConditions = [
      { id: customerId },
      { _id: customerId },
    ];

    if (ObjectId.isValid(customerId)) {
      userIdConditions.push({
        _id: new ObjectId(customerId),
      });
    }

    const customer = await db.collection("user").findOne(
      {
        $or: userIdConditions,
      },
      {
        projection: {
          _id: 1,
          name: 1,
          email: 1,
          image: 1,
          phone: 1,
          location: 1,
          bio: 1,
          role: 1,
          isBlocked: 1,
          createdAt: 1,
        },
      }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer profile retrieved successfully.",
      profile: {
        name: customer.name || "",
        email: customer.email || "",
        image: customer.image || "",
        phone: customer.phone || "",
        location: customer.location || "",
        bio: customer.bio || "",
        role: customer.role || "Customer",
        isBlocked: customer.isBlocked === true,
        createdAt: customer.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Customer profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve customer profile.",
    });
  }
};
//code for customer profile update page


export const updateCustomerProfile = async (req, res) => {
  try {
    const db = getDB();
    const customerId = req.user.id;

    const { name, phone, location, bio, image } = req.body;

    // Validate request body.
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body.",
      });
    }

    // Validate name.
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name cannot exceed 100 characters.",
      });
    }

    // Validate optional fields.
    if (
      phone !== undefined &&
      (typeof phone !== "string" ||
        (phone.trim() && !/^[+()\d\s-]{7,20}$/.test(phone.trim())))
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number.",
      });
    }

    if (
      location !== undefined &&
      (typeof location !== "string" || location.length > 150)
    ) {
      return res.status(400).json({
        success: false,
        message: "Location must be a string with a maximum of 150 characters.",
      });
    }

    if (
      bio !== undefined &&
      (typeof bio !== "string" || bio.length > 500)
    ) {
      return res.status(400).json({
        success: false,
        message: "Bio must be a string with a maximum of 500 characters.",
      });
    }

    if (image !== undefined) {
      if (typeof image !== "string" || image.length > 2048) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile image.",
        });
      }

      if (image.trim()) {
        try {
          const imageUrl = new URL(image);

          if (imageUrl.protocol !== "https:") {
            throw new Error("Invalid image protocol.");
          }
        } catch {
          return res.status(400).json({
            success: false,
            message: "Please provide a valid HTTPS image URL.",
          });
        }
      }
    }

    // Find the authenticated customer.
    const userIdConditions = [
      { id: customerId },
      { _id: customerId },
    ];

    if (ObjectId.isValid(customerId)) {
      userIdConditions.push({
        _id: new ObjectId(customerId),
      });
    }

    const usersCollection = db.collection("user");

    const updateFields = {
      name: name.trim(),
      updatedAt: new Date(),
    };

    if (phone !== undefined) {
      updateFields.phone = phone.trim();
    }

    if (location !== undefined) {
      updateFields.location = location.trim();
    }

    if (bio !== undefined) {
      updateFields.bio = bio.trim();
    }

    if (image !== undefined) {
      updateFields.image = image.trim();
    }

    const result = await usersCollection.updateOne(
      {
        $or: userIdConditions,
        role: "Customer",
      },
      {
        $set: updateFields,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found.",
      });
    }

    // Retrieve the updated profile.
    const updatedCustomer = await usersCollection.findOne(
      {
        $or: userIdConditions,
      },
      {
        projection: {
          name: 1,
          email: 1,
          image: 1,
          phone: 1,
          location: 1,
          bio: 1,
          role: 1,
          isBlocked: 1,
          createdAt: 1,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Customer profile updated successfully.",
      profile: {
        name: updatedCustomer.name || "",
        email: updatedCustomer.email || "",
        image: updatedCustomer.image || "",
        phone: updatedCustomer.phone || "",
        location: updatedCustomer.location || "",
        bio: updatedCustomer.bio || "",
        role: updatedCustomer.role || "Customer",
        isBlocked: updatedCustomer.isBlocked === true,
        createdAt: updatedCustomer.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Customer profile update error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update customer profile.",
    });
  }
};
