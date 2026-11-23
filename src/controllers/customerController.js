
import { getDB } from "../config/db.js";

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
