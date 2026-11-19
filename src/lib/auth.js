
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

import { getDB } from "../config/db.js";

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
    },
  });
};
