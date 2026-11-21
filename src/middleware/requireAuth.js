
import { createRemoteJWKSet, jwtVerify } from "jose";

const authBaseURL = process.env.BETTER_AUTH_URL;

if (!authBaseURL) {
  throw new Error("BETTER_AUTH_URL is missing.");
}

// Better Auth's public signing keys.
const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", authBaseURL)
);

export const requireAuth = async (req, res, next) => {
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

    // Verify signature, issuer, audience and expiration.
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authBaseURL,
      audience: authBaseURL,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    // Only use identity and role from the verified token.
    req.user = {
      id: payload.sub,
      email: typeof payload.email === "string"
        ? payload.email
        : undefined,
      role: payload.role,
    };

    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
};
