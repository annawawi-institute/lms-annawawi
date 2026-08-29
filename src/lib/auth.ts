import { betterAuth } from "better-auth";
import { d1 } from "better-auth/adapters/d1";

export function createAuth(env: Env) {
  return betterAuth({
    database: env.DB,
    socialProviders: {
      google: {
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
      },
    },
    baseURL: env.AUTH_BASE_URL ?? "http://localhost:8787",
  });
}

export type Auth = ReturnType<typeof createAuth>;
export { d1 };
