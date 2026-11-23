
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

const allowedCategories = [
  "Photography & Videography",
  "Wedding Venues",
  "Decoration & Florist",
  "Catering Services",
  "Makeup & Styling",
  "Wedding Fashion",
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
      { _id: new ObjectId(vendorId) },
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

//code for get vendor services

export const getMyServices = async (req, res) => {
  try {
    const db = getDB();

    // Get the vendor ID from the verified JWT
    const vendorId = req.user.id;

    const services = await db
      .collection("services")
      .find({ vendorId })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      totalServices: services.length,
      services,
    });
  } catch (error) {
    console.error("Get my services error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your services.",
    });
  }
};


// code for make a service active or inactive

export const updateServiceAvailability = async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { isActive } = req.body;
    const vendorId = req.user.id;

    // Validate service ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    // Validate availability value
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    const serviceCollection = db.collection("services");
    const serviceId = new ObjectId(id);

    // Find only the service owned by this vendor
    const service = await serviceCollection.findOne({
      _id: serviceId,
      vendorId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    // A service must be approved before it can be activated
    if (isActive && service.approvalStatus !== "Approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved services can be activated.",
      });
    }

    // Check the vendor account
    const userConditions = [
      { _id: vendorId },
      { id: vendorId },
    ];

    if (ObjectId.isValid(vendorId)) {
      userConditions.push({ _id: new ObjectId(vendorId) });
    }

    const vendor = await db.collection("user").findOne(
      { $or: userConditions },
      {
        projection: {
          subscriptionPlan: 1,
          isBlocked: 1,
        },
      }
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

    // Enforce the Free plan's active service limit
    if (isActive && vendor.subscriptionPlan !== "Premium") {
      const activeServicesCount = await serviceCollection.countDocuments({
        vendorId,
        isActive: true,
        _id: { $ne: serviceId },
      });

      if (activeServicesCount >= 3) {
        return res.status(403).json({
          success: false,
          message:
            "Free plan allows a maximum of 3 active services. Upgrade to Premium to activate more.",
        });
      }
    }

    // Update availability
    await serviceCollection.updateOne(
      { _id: serviceId, vendorId },
      {
        $set: {
          isActive,
          updatedAt: new Date(),
        },
      }
    );

    const updatedService = await serviceCollection.findOne({
      _id: serviceId,
      vendorId,
    });

    return res.status(200).json({
      success: true,
      message: `Service ${isActive ? "activated" : "deactivated"} successfully.`,
      service: updatedService,
    });
  } catch (error) {
    console.error("Update service availability error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update service availability.",
    });
  }
};
// code for delating a service

export const deleteService = async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const vendorId = req.user.id;

    // Validate service ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const serviceId = new ObjectId(id);

    // Delete only the service owned by this vendor
    const result = await db.collection("services").deleteOne({
      _id: serviceId,
      vendorId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully.",
    });
  } catch (error) {
    console.error("Delete service error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete service.",
    });
  }
};

//code to edit a srevice

export const updateService = async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const vendorId = req.user.id;

    const {
      title,
      category,
      description,
      price,
      location,
      images,
    } = req.body;

    // Validate service ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    // Validate required fields
    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof location !== "string" ||
      !location.trim() ||
      !Array.isArray(images) ||
      images.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required service fields.",
      });
    }

    // Validate category
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service category.",
      });
    }

    // Validate price
    const servicePrice = Number(price);

    if (
      price === undefined ||
      price === null ||
      price === "" ||
      !Number.isFinite(servicePrice) ||
      servicePrice <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid positive number.",
      });
    }

    // Validate image URLs
    const validImages = images.every(
      (image) =>
        typeof image === "string" &&
        /^https:\/\/.+/i.test(image)
    );

    if (!validImages || images.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Please provide up to 5 valid HTTPS image URLs.",
      });
    }

    const serviceCollection = db.collection("services");
    const serviceId = new ObjectId(id);

    // Verify ownership
    const existingService = await serviceCollection.findOne({
      _id: serviceId,
      vendorId,
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    // Verify vendor account
    const userConditions = [
      { _id: vendorId },
      { id: vendorId },
    ];

    if (ObjectId.isValid(vendorId)) {
      userConditions.push({
        _id: new ObjectId(vendorId),
      });
    }

    const vendor = await db.collection("user").findOne(
      { $or: userConditions },
      {
        projection: {
          isBlocked: 1,
        },
      }
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

    // Update only the allowed fields
    await serviceCollection.updateOne(
      {
        _id: serviceId,
        vendorId,
      },
      {
        $set: {
          title: title.trim(),
          category,
          description: description.trim(),
          price: servicePrice,
          location: location.trim(),
          images,
          updatedAt: new Date(),
        },
      }
    );

    const updatedService = await serviceCollection.findOne({
      _id: serviceId,
      vendorId,
    });

    return res.status(200).json({
      success: true,
      message: "Service updated successfully.",
      service: updatedService,
    });
  } catch (error) {
    console.error("Update service error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update service.",
    });
  }
};

// code for public show service
// Get public services with server-side search, filtering, and sorting

export const getPublicServices = async (req, res) => {
  try {
    const {
      search = "",
      category = "All Categories",
      location = "All Locations",
      sort = "default",
    } = req.query;

    const db = getDB();
    const servicesCollection = db.collection("services");

    // Only approved and active services are publicly visible
    const filter = {
      approvalStatus: "Approved",
      isActive: true,
    };

    // Category filtering
    if (category && category !== "All Categories") {
      filter.category = category;
    }

    // Location filtering
    if (location && location !== "All Locations") {
      filter.location = location;
    }

    // Search by service title or description
    if (search.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
      ];
    }

    // Server-side sorting
    const sortOptions = {
      default: { createdAt: -1 },
      "price-low": { price: 1 },
      "price-high": { price: -1 },
    };

    const sortQuery = sortOptions[sort] || sortOptions.default;

    // Fetch matching services
    const services = await servicesCollection
      .find(filter)
      .sort(sortQuery)
      .toArray();

    // Get all available locations for public services
    const locations = await servicesCollection.distinct("location", {
      approvalStatus: "Approved",
      isActive: true,
    });

    // Map database title to the existing frontend ServiceCard field
    const formattedServices = services.map((service) => ({
      ...service,
      serviceName: service.title,
    }));

    return res.status(200).json({
      success: true,
      totalServices: formattedServices.length,
      locations: locations.sort(),
      services: formattedServices,
    });
  } catch (error) {
    console.error("Get public services error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve services",
    });
  }
};


// Get latest 6 approved and active services for the public Home page

export const getFeaturedServices = async (req, res) => {
  try {
    const db = getDB();

    const services = await db
      .collection("services")
      .find({
        approvalStatus: "Approved",
        isActive: true,
      })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    // Return an empty array if no public services exist
    if (services.length === 0) {
      return res.status(200).json({
        success: true,
        totalServices: 0,
        services: [],
      });
    }

    // Collect valid vendor IDs
    const vendorIds = services
      .map((service) => service.vendorId)
      .filter((vendorId) => ObjectId.isValid(vendorId))
      .map((vendorId) => new ObjectId(vendorId));

    // Fetch vendor information from Better Auth's user collection
    const vendors = await db
      .collection("user")
      .find(
        {
          _id: { $in: vendorIds },
        },
        {
          projection: {
            name: 1,
            image: 1,
            businessName: 1,
          },
        }
      )
      .toArray();

    // Create a lookup map for vendor information
    const vendorMap = new Map(
      vendors.map((vendor) => [vendor._id.toString(), vendor])
    );

    // Attach vendor information to each service
    const formattedServices = services.map((service) => {
      const vendor = vendorMap.get(service.vendorId);

      return {
        ...service,
        vendor: vendor
          ? {
              name: vendor.name || "Unknown Vendor",
              image: vendor.image || "",
              businessName: vendor.businessName || "",
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      totalServices: formattedServices.length,
      services: formattedServices,
    });
  } catch (error) {
    console.error("Get featured services error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve featured services.",
    });
  }
};

//code for service details page


// Get a single service by ID with vendor information

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate service ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const db = getDB();

    // Find only approved and active services
    const service = await db.collection("services").findOne({
      _id: new ObjectId(id),
      approvalStatus: "Approved",
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found or currently unavailable.",
      });
    }

    // Find vendor information
    let vendor = null;

    if (ObjectId.isValid(service.vendorId)) {
      vendor = await db.collection("user").findOne(
        {
          _id: new ObjectId(service.vendorId),
        },
        {
          projection: {
            name: 1,
            image: 1,
            businessName: 1,
            email: 1,
          },
        }
      );
    }

    // Format the response
    const formattedService = {
      ...service,
      serviceName: service.title,
      vendor: vendor
        ? {
            name: vendor.name || "Unknown Vendor",
            image: vendor.image || "",
            businessName: vendor.businessName || "",
            email: vendor.email || "",
          }
        : null,
    };

    return res.status(200).json({
      success: true,
      service: formattedService,
    });
  } catch (error) {
    console.error("Get service details error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve service details.",
    });
  }
};
