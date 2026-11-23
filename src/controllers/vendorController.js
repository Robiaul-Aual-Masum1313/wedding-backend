
import { getDB } from "../config/db.js";

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
