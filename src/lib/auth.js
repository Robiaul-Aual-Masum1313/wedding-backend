import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { getOAuthState } from "better-auth/api";
import { getDB } from "../config/db.js";
import { jwt } from "better-auth/plugins";

export const createAuth = () => {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is missing.");
  }

  if (!process.env.BETTER_AUTH_URL || !process.env.CLIENT_URL) {
    throw new Error("Better Auth URL configuration is missing.");
  }

  return betterAuth({
    appName: "WedPlan",
    database: mongodbAdapter(getDB()),

    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.CLIENT_URL],

    // newly added code start
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
// newly added code end

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },

    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "Customer",
          input: true,
        },
        businessName: {
          type: "string",
          required: false,
          input: true,
        },
        isBlocked: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        subscriptionPlan: {
          type: "string",
          required: false,
          defaultValue: "Free",
          input: false,
        },
        subscriptionExpiresAt: {
          type: "date",
          required: false,
          input: false,
        },
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            let requestedRole = user.role ?? "Customer";
            let businessName = user.businessName ?? "";

            // Handle Google OAuth registration.
            if (ctx?.path === "/callback/:id") {
              const additionalData = await getOAuthState();

              requestedRole = additionalData?.role ?? "Customer";

              businessName =
                typeof additionalData?.businessName === "string"
                  ? additionalData.businessName.trim()
                  : "";
            }

            // Only Customer and Vendor registrations are allowed.
            if (!["Customer", "Vendor"].includes(requestedRole)) {
              throw new Error("Invalid registration role.");
            }

            // A Vendor must provide a business name.
            if (requestedRole === "Vendor") {
              if (!businessName || businessName.length > 100) {
                throw new Error("A valid business name is required.");
              }
            }

            return {
              data: {
                ...user,
                role: requestedRole,
                ...(requestedRole === "Vendor" ? { businessName } : {}),
              },
            };
          },
        },
      },
    },

    plugins: [
      jwt({
        jwt: {
          expirationTime: "5m",

          definePayload: ({ user }) => ({
            id: user.id,
            email: user.email,
            role: user.role,
          }),
        },
      }),
    ],
  });
};
