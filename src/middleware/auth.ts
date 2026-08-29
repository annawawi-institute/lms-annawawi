import { createMiddleware } from "hono/factory";
import type { Auth } from "../lib/auth";

export const requireAuth = (auth: Auth) =>
  createMiddleware(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "unauthorized" }, 401);
    c.set("user", session.user);
    await next();
  });

export const requireRole =
  (auth: Auth, ...roles: string[]) =>
  async (c: any, next: any) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "unauthorized" }, 401);
    if (!roles.includes(session.user.role))
      return c.json({ error: "forbidden" }, 403);
    c.set("user", session.user);
    await next();
  };
