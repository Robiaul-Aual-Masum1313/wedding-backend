
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { createRemoteJWKSet, jwtVerify } from "jose";

const authBaseURL = process.env.BETTER_AUTH_URL;

if (!authBaseURL) {
  throw new Error("BETTER_AUTH_URL is missing.");
}

// Better Auth public signing keys.
const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", authBaseURL)
);

export const requireAuth = async (req, res, next) => {
  let payload;

  // 1. Verify authentication token.
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const result = await jwtVerify(token, JWKS, {
      issuer: authBaseURL,
      audience: authBaseURL,
    });

    payload = result.payload;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }

  // 2. Find the current user in MongoDB.
  try {
    const userIdConditions = [
      { id: payload.sub },
      { _id: payload.sub },
    ];

    if (ObjectId.isValid(payload.sub)) {
      userIdConditions.push({
        _id: new ObjectId(payload.sub),
      });
    }

    const currentUser = await getDB()
      .collection("user")
      .findOne({
        $or: userIdConditions,
      });

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    // 3. Check the latest blocked status from MongoDB.
    if (currentUser.isBlocked === true) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
    }

    // 4. Attach current database user information.
    req.user = {
      id: String(currentUser.id ?? currentUser._id),
      email: currentUser.email,
      role: currentUser.role || "Customer",
    };

    next();
  } catch (error) {
    console.error("User authentication database error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify your account status.",
    });
  }
};
