
const validRoles = ["Customer", "Vendor", "Admin"];

export const requireRole = (...allowedRoles) => {
  // Prevent accidental use of an invalid role in route configuration.
  const invalidRoles = allowedRoles.filter(
    (role) => !validRoles.includes(role)
  );

  if (invalidRoles.length > 0) {
    throw new Error(
      `Invalid role configuration: ${invalidRoles.join(", ")}`
    );
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }
  //     console.log("User role from token:", req.user.role);
  // console.log("Allowed roles:", allowedRoles);

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this resource.",
      });
    }

    next();
  };
};
