import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
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

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
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
          before: async (user) => {
            const requestedRole = user.role ?? "Customer";

            if (!["Customer", "Vendor"].includes(requestedRole)) {
              throw new Error("Invalid registration role.");
            }

            return {
              data: {
                ...user,
                role: requestedRole,
              },
            };
          },
        },
      },
    },
    plugins: [
      jwt({
        jwt: {
          // Keep tokens short-lived.
          expirationTime: "5m",

          // Only expose the claims our API needs.
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
