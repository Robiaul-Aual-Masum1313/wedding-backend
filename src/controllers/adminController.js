
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
