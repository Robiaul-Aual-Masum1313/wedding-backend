
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

export const createBooking = async (req, res) => {
  try {
    const { serviceId, eventDate, eventLocation, message } = req.body;

    // Validate required fields
    if (!serviceId || !eventDate || !eventLocation?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Service, event date, and event location are required.",
      });
    }

    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const selectedDate = new Date(eventDate);

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid event date.",
      });
    }

    // Event date must be in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return res.status(400).json({
        success: false,
        message: "Event date cannot be in the past.",
      });
    }

    const db = getDB();

    // Identify the authenticated customer from the JWT
    const customerId = req.user.id;

    // Find the selected service
    const service = await db.collection("services").findOne({
      _id: new ObjectId(serviceId),
      approvalStatus: "Approved",
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found or currently unavailable.",
      });
    }

    // Prevent vendors from booking their own services
    if (service.vendorId === customerId) {
      return res.status(403).json({
        success: false,
        message: "You cannot book your own service.",
      });
    }

    // Prevent duplicate active booking requests
    const existingBooking = await db.collection("bookings").findOne({
      serviceId,
      customerId,
      eventDate: selectedDate,
      status: { $in: ["Pending", "Accepted"] },
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: "You already have an active booking for this service and date.",
      });
    }

    // Create booking
    const booking = {
      serviceId,
      serviceTitle: service.title,
      serviceImage: service.images?.[0] || "",
      vendorId: service.vendorId,
      customerId,
      eventDate: selectedDate,
      eventLocation: eventLocation.trim(),
      message: typeof message === "string" ? message.trim() : "",
      status: "Pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("bookings").insertOne(booking);

    return res.status(201).json({
      success: true,
      message: "Booking request submitted successfully.",
      booking: {
        ...booking,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Create booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to submit booking request.",
    });
  }
};
// code for retriving customer's all  booking

export const getMyBookings = async (req, res) => {
  try {
    const db = getDB();

    // Get bookings belonging to the authenticated customer.
    const bookings = await db
      .collection("bookings")
      .find({ customerId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    // Collect vendor IDs from the bookings.
    const vendorIds = [
      ...new Set(
        bookings
          .map((booking) => booking.vendorId)
          .filter(Boolean)
      ),
    ];

    // Fetch vendor information.
    const vendors = await db
      .collection("user")
      .find(
        { _id: { $in: vendorIds } },
        {
          projection: {
            name: 1,
            email: 1,
            image: 1,
            businessName: 1,
          },
        }
      )
      .toArray();

    // Match each booking with its vendor.
    const vendorMap = new Map(
      vendors.map((vendor) => [vendor._id, vendor])
    );

    const formattedBookings = bookings.map((booking) => ({
      ...booking,
      vendor: vendorMap.get(booking.vendorId) || null,
    }));

    return res.status(200).json({
      success: true,
      message: "Your bookings retrieved successfully.",
      total: formattedBookings.length,
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your bookings.",
    });
  }
};

//code for let a cutomer cancel her pending bookings

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate booking ID.
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const db = getDB();

    // Find the booking belonging to the authenticated customer.
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(id),
      customerId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    // Only Pending bookings can be cancelled.
    if (booking.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `You cannot cancel a booking with ${booking.status} status.`,
      });
    }

    // Update only if the booking is still Pending.
    const result = await db.collection("bookings").updateOne(
      {
        _id: new ObjectId(id),
        customerId: req.user.id,
        status: "Pending",
      },
      {
        $set: {
          status: "Cancelled",
          updatedAt: new Date(),
        },
      }
    );

    // Protect against a concurrent status change.
    if (result.matchedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "This booking can no longer be cancelled.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel booking.",
    });
  }
};

//code for retrive bookings data to vendor deshboard

export const getVendorBookingRequests = async (req, res) => {
  try {
    const db = getDB();

    // Retrieve only bookings belonging to the authenticated vendor.
    const bookings = await db
      .collection("bookings")
      .find({ vendorId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    // Collect customer IDs.
    const customerIds = [
      ...new Set(
        bookings
          .map((booking) => booking.customerId)
          .filter(Boolean)
      ),
    ];

    // Retrieve customer information.
    const customers = await db
      .collection("user")
      .find(
        { _id: { $in: customerIds } },
        {
          projection: {
            name: 1,
            email: 1,
            image: 1,
          },
        }
      )
      .toArray();

    // Create a customer lookup map.
    const customerMap = new Map(
      customers.map((customer) => [customer._id, customer])
    );

    // Attach customer information to each booking.
    const formattedBookings = bookings.map((booking) => ({
      ...booking,
      customer: customerMap.get(booking.customerId) || null,
    }));

    return res.status(200).json({
      success: true,
      message: "Vendor booking requests retrieved successfully.",
      total: formattedBookings.length,
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("Get vendor booking requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve booking requests.",
    });
  }
};

//code for vendor accecpt bookings


export const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate booking ID.
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const db = getDB();

    // Find only a booking belonging to the authenticated vendor.
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(id),
      vendorId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    // Only Pending bookings can be accepted.
    if (booking.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `You cannot accept a booking with ${booking.status} status.`,
      });
    }

    // Update only if the booking is still Pending.
    const result = await db.collection("bookings").updateOne(
      {
        _id: new ObjectId(id),
        vendorId: req.user.id,
        status: "Pending",
      },
      {
        $set: {
          status: "Accepted",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "This booking can no longer be accepted.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking accepted successfully.",
    });
  } catch (error) {
    console.error("Accept booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to accept booking.",
    });
  }
};

//code for rejecting a customer booking by vendor


export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate booking ID.
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const db = getDB();

    // Find only a booking belonging to the authenticated vendor.
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(id),
      vendorId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    // Only Pending bookings can be rejected.
    if (booking.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `You cannot reject a booking with ${booking.status} status.`,
      });
    }

    // Update only if the booking is still Pending.
    const result = await db.collection("bookings").updateOne(
      {
        _id: new ObjectId(id),
        vendorId: req.user.id,
        status: "Pending",
      },
      {
        $set: {
          status: "Rejected",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "This booking can no longer be rejected.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking rejected successfully.",
    });
  } catch (error) {
    console.error("Reject booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reject booking.",
    });
  }
};
