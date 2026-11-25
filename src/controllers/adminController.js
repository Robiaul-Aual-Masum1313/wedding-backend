
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

const allowedStatuses = ["Pending", "Approved", "Rejected"];

const allowedCategories = [
  "Photography & Videography",
  "Wedding Venues",
  "Decoration & Florist",
  "Catering Services",
  "Makeup & Styling",
  "Wedding Fashion",
];

// Escape special regex characters in search input
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const getAllServices = async (req, res) => {
  try {
    const db = getDB();

    const servicesCollection = db.collection("services");
    const usersCollection = db.collection("user");

    // 1. Read query parameters
    const search = (req.query.search || "").trim();
    const category = req.query.category;
    const status = req.query.status;

    // 2. Validate query parameters
    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search cannot exceed 100 characters.",
      });
    }

    if (
      category &&
      !allowedCategories.includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid service category.",
      });
    }

    if (
      status &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid service status.",
      });
    }

    // 3. Get overall statistics (without filters)
    const [
      total,
      pending,
      approved,
      rejected,
    ] = await Promise.all([
      servicesCollection.countDocuments({}),
      servicesCollection.countDocuments({
        approvalStatus: "Pending",
      }),
      servicesCollection.countDocuments({
        approvalStatus: "Approved",
      }),
      servicesCollection.countDocuments({
        approvalStatus: "Rejected",
      }),
    ]);

    // 4. Build MongoDB filter
    const filters = [];

    if (category) {
      filters.push({
        category,
      });
    }

    if (status) {
      filters.push({
        approvalStatus: status,
      });
    }

    // 5. Search service title and vendor information
    if (search) {
      const searchRegex = new RegExp(
        escapeRegex(search),
        "i"
      );

      // Find vendors matching the search
      const matchingVendors = await usersCollection
        .find(
          {
            $or: [
              { name: searchRegex },
              { businessName: searchRegex },
              { email: searchRegex },
            ],
          },
          {
            projection: {
              _id: 1,
              id: 1,
            },
          }
        )
        .toArray();

      // Collect vendor IDs
      const matchingVendorIds = new Set();

      matchingVendors.forEach((vendor) => {
        if (vendor._id) {
          matchingVendorIds.add(String(vendor._id));
        }

        if (vendor.id) {
          matchingVendorIds.add(String(vendor.id));
        }
      });

      const searchConditions = [
        {
          title: searchRegex,
        },
      ];

      if (matchingVendorIds.size > 0) {
        searchConditions.push({
          vendorId: {
            $in: [...matchingVendorIds],
          },
        });
      }

      filters.push({
        $or: searchConditions,
      });
    }

    // 6. Combine all filters
    const query = filters.length
      ? { $and: filters }
      : {};

    // 7. Retrieve filtered services
    const services = await servicesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // 8. Find vendor information for returned services
    const vendorIds = [
      ...new Set(
        services
          .map((service) => service.vendorId)
          .filter(Boolean)
          .map(String)
      ),
    ];

    const vendorConditions = [];

    vendorIds.forEach((vendorId) => {
      vendorConditions.push(
        { _id: vendorId },
        { id: vendorId }
      );

      if (ObjectId.isValid(vendorId)) {
        vendorConditions.push({
          _id: new ObjectId(vendorId),
        });
      }
    });

    const vendors = vendorConditions.length
      ? await usersCollection
          .find(
            {
              $or: vendorConditions,
            },
            {
              projection: {
                name: 1,
                businessName: 1,
                email: 1,
                id: 1,
              },
            }
          )
          .toArray()
      : [];

    // 9. Create vendor lookup map
    const vendorMap = new Map();

    vendors.forEach((vendor) => {
      const vendorName =
        vendor.businessName ||
        vendor.name ||
        vendor.email ||
        "Unknown Vendor";

      if (vendor._id) {
        vendorMap.set(String(vendor._id), vendorName);
      }

      if (vendor.id) {
        vendorMap.set(String(vendor.id), vendorName);
      }
    });

    // 10. Attach vendor names to services
    const formattedServices = services.map((service) => ({
      ...service,
      vendor:
        vendorMap.get(String(service.vendorId)) ||
        "Unknown Vendor",
    }));

    // 11. Send response
    return res.status(200).json({
      success: true,
      totalServices: total,
      totalFiltered: formattedServices.length,
      stats: {
        total,
        pending,
        approved,
        rejected,
      },
      services: formattedServices,
    });
  } catch (error) {
    console.error("Get all services error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve services.",
    });
  }
};

//code for approved or reject service 


export const updateServiceApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus } = req.body;

    // Validate service ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    // Only Approved and Rejected are allowed
    if (!["Approved", "Rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Approval status must be Approved or Rejected",
      });
    }

    const db = getDB();
    const servicesCollection = db.collection("services");

    const service = await servicesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Approve = active, Reject = inactive
    const isActive = approvalStatus === "Approved";

    await servicesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          approvalStatus,
          isActive,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: `Service ${approvalStatus.toLowerCase()} successfully`,
      service: {
        ...service,
        approvalStatus,
        isActive,
      },
    });
  } catch (error) {
    console.error("Update service approval error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update service approval",
    });
  }
};

export const deleteRejectedService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    const db = getDB();
    const servicesCollection = db.collection("services");

    // Delete only if the service is rejected
    const result = await servicesCollection.deleteOne({
      _id: new ObjectId(id),
      approvalStatus: "Rejected",
    });

    if (result.deletedCount === 0) {
      const service = await servicesCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Only rejected services can be deleted",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rejected service deleted successfully",
    });
  } catch (error) {
    console.error("Delete rejected service error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete rejected service",
    });
  }
};


//code for active or deactive a approved service by admin

export const updateAdminServiceAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Validate service ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID",
      });
    }

    // Validate availability value
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value",
      });
    }

    const db = getDB();
    const servicesCollection = db.collection("services");

    // Find the service
    const service = await servicesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Only approved services can change availability
    if (service.approvalStatus !== "Approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved services can change availability",
      });
    }

    // Update availability
    await servicesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isActive,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: `Service ${
        isActive ? "activated" : "deactivated"
      } successfully`,
      isActive,
    });
  } catch (error) {
    console.error("Update admin service availability error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update service availability",
    });
  }
};

//code for admin user manger page 


const allowedUserRoles = ["Customer", "Vendor", "Admin"];
const allowedUserStatuses = ["Active", "Blocked"];

export const getAllUsers = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("user");

    // 1. Read query parameters
    const search = (req.query.search || "").trim();
    const role = req.query.role;
    const status = req.query.status;

    // 2. Validate query parameters
    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search cannot exceed 100 characters.",
      });
    }

    if (role && !allowedUserRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    if (status && !allowedUserStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status.",
      });
    }

    // 3. Get overall statistics (without filters)
    const [
      total,
      customers,
      vendors,
      admins,
      blocked,
    ] = await Promise.all([
      usersCollection.countDocuments({}),
      usersCollection.countDocuments({ role: "Customer" }),
      usersCollection.countDocuments({ role: "Vendor" }),
      usersCollection.countDocuments({ role: "Admin" }),
      usersCollection.countDocuments({ isBlocked: true }),
    ]);

    // 4. Build MongoDB filters
    const filters = [];

    if (role) {
      filters.push({ role });
    }

    if (status === "Blocked") {
      filters.push({ isBlocked: true });
    } else if (status === "Active") {
      // Also include older user documents where isBlocked is missing.
      filters.push({
        isBlocked: { $ne: true },
      });
    }

    // 5. Search by name or email
    if (search) {
      const searchRegex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      filters.push({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
        ],
      });
    }

    // 6. Combine filters
    const query = filters.length
      ? { $and: filters }
      : {};

    // 7. Retrieve filtered users
    const users = await usersCollection
      .find(query, {
        projection: {
          _id: 1,
          id: 1,
          name: 1,
          email: 1,
          role: 1,
          isBlocked: 1,
          createdAt: 1,
          image: 1,
        },
      })
      .sort({ createdAt: -1 })
      .toArray();

    // 8. Format users for frontend
    const formattedUsers = users.map((user) => ({
      id: String(user._id ?? user.id),
      name: user.name || "Unknown User",
      email: user.email,
      role: user.role || "Customer",
      status: user.isBlocked ? "Blocked" : "Active",
      joinedAt: user.createdAt || null,
      image: user.image || "",
    }));

    // 9. Send response
    return res.status(200).json({
      success: true,
      totalUsers: total,
      totalFiltered: formattedUsers.length,
      stats: {
        total,
        customers,
        vendors,
        admins,
        blocked,
      },
      users: formattedUsers,
    });
  } catch (error) {
    console.error("Get all users error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve users.",
    });
  }
};

//code for block a user by admin 


export const updateUserStatus = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection("user");

    const { id } = req.params;
    const { isBlocked } = req.body;

    // 1. Validate user ID.
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    // 2. Validate blocked status.
    if (typeof isBlocked !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isBlocked must be a boolean value.",
      });
    }

    // 3. Find the target user.
    const targetUser = await usersCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // 4. Prevent an Admin from changing their own status.
    const targetUserId = String(
      targetUser.id ?? targetUser._id
    );

    if (targetUserId === req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own account status.",
      });
    }

    // 5. Prevent changing Admin accounts.
    if (targetUser.role === "Admin") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be blocked or unblocked.",
      });
    }

    // 6. Check whether the status is already the requested value.
    if (targetUser.isBlocked === isBlocked) {
      return res.status(200).json({
        success: true,
        message: isBlocked
          ? "This user is already blocked."
          : "This user is already active.",
        user: {
          id: targetUserId,
          status: isBlocked ? "Blocked" : "Active",
        },
      });
    }

    // 7. Update user status.
    await usersCollection.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          isBlocked,
          updatedAt: new Date(),
        },
      }
    );

    // 8. Send response.
    return res.status(200).json({
      success: true,
      message: isBlocked
        ? "User blocked successfully."
        : "User unblocked successfully.",
      user: {
        id: targetUserId,
        status: isBlocked ? "Blocked" : "Active",
      },
    });
  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update user status.",
    });
  }
};


export const getAllTransactions = async (req, res) => {
  try {
    const db = getDB();

    const transactionsCollection = db.collection("transactions");
    const usersCollection = db.collection("user");

    // 1. Retrieve all transactions, newest first.
    const transactions = await transactionsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // 2. Collect unique vendor IDs from transactions.
    const vendorIds = [
      ...new Set(
        transactions
          .map((transaction) => transaction.vendorId)
          .filter(Boolean)
          .map(String)
      ),
    ];

    // 3. Build vendor lookup conditions.
    const vendorConditions = [];

    vendorIds.forEach((vendorId) => {
      vendorConditions.push(
        { _id: vendorId },
        { id: vendorId }
      );

      if (ObjectId.isValid(vendorId)) {
        vendorConditions.push({
          _id: new ObjectId(vendorId),
        });
      }
    });

    // 4. Retrieve vendor information.
    const vendors = vendorConditions.length
      ? await usersCollection
          .find(
            {
              $or: vendorConditions,
            },
            {
              projection: {
                _id: 1,
                id: 1,
                name: 1,
                businessName: 1,
                email: 1,
                image: 1,
              },
            }
          )
          .toArray()
      : [];

    // 5. Create a vendor lookup map.
    const vendorMap = new Map();

    vendors.forEach((vendor) => {
      const vendorInfo = {
        name: vendor.name || "Unknown Vendor",
        businessName: vendor.businessName || "",
        email: vendor.email || "",
        image: vendor.image || "",
      };

      if (vendor._id) {
        vendorMap.set(String(vendor._id), vendorInfo);
      }

      if (vendor.id) {
        vendorMap.set(String(vendor.id), vendorInfo);
      }
    });

    // 6. Attach vendor information to each transaction.
    const formattedTransactions = transactions.map((transaction) => ({
      id: String(transaction._id),
      vendorId: String(transaction.vendorId || ""),
      vendor: vendorMap.get(String(transaction.vendorId)) || null,
      plan: transaction.plan || "Unknown",
      amount: Number(transaction.amount) || 0,
      currency: transaction.currency || "usd",
      status: transaction.status || "Unknown",
      stripeSessionId: transaction.stripeSessionId || "",
      stripeSubscriptionId: transaction.stripeSubscriptionId || "",
      createdAt: transaction.createdAt || null,
    }));

    // 7. Calculate transaction statistics.
    const totalTransactions = formattedTransactions.length;

    const paidTransactions = formattedTransactions.filter(
      (transaction) => transaction.status.toLowerCase() === "paid"
    ).length;

    const failedTransactions = formattedTransactions.filter(
      (transaction) => transaction.status.toLowerCase() === "failed"
    ).length;

    const pendingTransactions = formattedTransactions.filter(
      (transaction) => transaction.status.toLowerCase() === "pending"
    ).length;

    // 8. Send response.
    return res.status(200).json({
      success: true,
      stats: {
        totalTransactions,
        paidTransactions,
        failedTransactions,
        pendingTransactions,
      },
      totalFiltered: formattedTransactions.length,
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error("Get all transactions error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve transactions.",
    });
  }
};


//code for admin overview page

export const getAdminOverview = async (req, res) => {
  try {
    const db = getDB();

    const usersCollection = db.collection("user");
    const servicesCollection = db.collection("services");
    const bookingsCollection = db.collection("bookings");
    const transactionsCollection = db.collection("transactions");

    // 1. Get platform statistics.
    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalServices,
      totalBookings,
      pendingApprovals,
      paidTransactionStats,
    ] = await Promise.all([
      usersCollection.countDocuments({}),
      usersCollection.countDocuments({ role: "Vendor" }),
      usersCollection.countDocuments({ role: "Customer" }),
      servicesCollection.countDocuments({}),
      bookingsCollection.countDocuments({}),
      servicesCollection.countDocuments({
        approvalStatus: "Pending",
      }),

      // Calculate revenue only from successful payments.
      transactionsCollection.aggregate([
        {
          $match: {
            status: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $convert: {
                  input: "$amount",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
            successfulPayments: {
              $sum: 1,
            },
          },
        },
      ]).toArray(),
    ]);

    // 2. Get the 4 newest users.
    const recentUsers = await usersCollection
      .find(
        {},
        {
          projection: {
            _id: 1,
            id: 1,
            name: 1,
            email: 1,
            role: 1,
            image: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(4)
      .toArray();

    // 3. Get the 3 newest services.
    const recentServices = await servicesCollection
      .find(
        {},
        {
          projection: {
            _id: 1,
            title: 1,
            category: 1,
            approvalStatus: 1,
            createdAt: 1,
            images: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();

    // 4. Extract payment statistics.
    const paymentStats = paidTransactionStats[0] || {
      totalRevenue: 0,
      successfulPayments: 0,
    };

    // 5. Format recent users.
    const formattedUsers = recentUsers.map((user) => ({
      id: String(user._id ?? user.id),
      name: user.name || "Unknown User",
      email: user.email || "",
      role: user.role || "Customer",
      image: user.image || "",
      createdAt: user.createdAt || null,
    }));

    // 6. Format recent services.
    const formattedServices = recentServices.map((service) => ({
      id: String(service._id),
      title: service.title || "Untitled Service",
      category: service.category || "Uncategorized",
      approvalStatus: service.approvalStatus || "Pending",
      createdAt: service.createdAt || null,
      images: service.images || [],
    }));

    // 7. Send response.
    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalServices,
        totalBookings,
        totalRevenue: paymentStats.totalRevenue,
        pendingApprovals,
        successfulPayments: paymentStats.successfulPayments,
      },
      recentUsers: formattedUsers,
      recentServices: formattedServices,
    });
  } catch (error) {
    console.error("Get admin overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve admin overview.",
    });
  }
};
