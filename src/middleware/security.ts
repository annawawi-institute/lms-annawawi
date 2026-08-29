// src/middleware/security.ts — Security headers + CSP + Rate Limiting
import { secureHeaders } from "hono/secure-headers";

// ═══════════════════════════════════════════════
// CSP untuk embed: Tally, Google Form, YouTube
// ═══════════════════════════════════════════════

export function cspWithEmbed() {
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "https://tally.so", "https://docs.google.com", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
    xContentTypeOptions: "nosniff",
    xFrameOptions: "SAMEORIGIN",
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    xXssProtection: "1; mode=block",
    crossOriginEmbedderPolicy: "require-corp",
  });
}

// ═══════════════════════════════════════════════
// Rate limiting per IP (in-memory per worker instance)
// ═══════════════════════════════════════════════

const requests = new Map<string, number[]>();

export function rateLimit(maxRequests: number, timeWindowMs: number) {
  return async (c: any, next: any) => {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    const now = Date.now();
    const times = requests.get(ip) || [];
    const recent = times.filter((t: number) => now - t < timeWindowMs);

    if (recent.length >= maxRequests) {
      return c.json({ error: "Too many requests" }, 429);
    }

    recent.push(now);
    requests.set(ip, recent);
    await next();
  };
}

// ═══════════════════════════════════════════════
// RBAC middleware
// ═══════════════════════════════════════════════

import { createAuth } from "../lib/auth";

export async function requireAuth(c: any, next: any) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.redirect("/login");
  c.set("user", session.user);
  await next();
}

export async function requireRole(roles: string[]) {
  return async (c: any, next: any) => {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.redirect("/login");
    if (!roles.includes(session.user.role as string)) {
      return c.html(`<p>Akses ditolak. <a href="/dashboard">Kembali</a></p>`, 403);
    }
    c.set("user", session.user);
    await next();
  };
}
