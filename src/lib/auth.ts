// src/lib/auth.ts — Better Auth configuration for Cloudflare D1
// https://www.better-auth.com/docs/integrations/hono

import { betterAuth } from "better-auth";

export function createAuth(env: Env) {
  return betterAuth({
    database: env.DB,
    baseURL: env.AUTH_BASE_URL,

    // Social providers
    socialProviders: {
      google: {
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
      },
    },

    // Custom user fields
    user: {
      additionalFields: {
        role: {
          type: ["admin", "guru", "siswa"],
          required: false,
          defaultValue: "siswa",
          input: false, // Cannot be set by user input
        },
        noWa: {
          type: "string",
          required: false,
        },
      },
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
