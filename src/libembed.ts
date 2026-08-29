// src/lib/embed.ts — Whitelist + Normalisasi URL Embed

// ═══════════════════════════════════════════════
// Whitelist domain yang diizinkan untuk embed
// ═══════════════════════════════════════════════

const EMBED_WHITELIST: { test: RegExp; provider: string }[] = [
  { test: /^(https?:\/\/)?([a-z0-9-]+\.)*tally\.so$/i, provider: "tally" },
  { test: /^(https?:\/\/)?(www\.)?docs\.google\.com$/i, provider: "google_form" },
  { test: /^(https?:\/\/)?(www\.)?youtube\.com$/i, provider: "youtube" },
  { test: /^(https?:\/\/)?(www\.)?youtube-nocookie\.com$/i, provider: "youtube" },
];

const EMBED_WHITELIST_DOMAIN_ONLY = [
  "tally.so",
  "*.tally.so",
  "docs.google.com",
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
];

export function isEmbedAllowed(url: string): { allowed: boolean; provider?: string; normalizedUrl?: string; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, error: "URL tidak valid" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { allowed: false, error: "Protokol harus http atau https" };
  }

  const host = parsed.hostname.toLowerCase();
  let matchedProvider: string | undefined;

  for (const entry of EMBED_WHITELIST) {
    if (entry.test.test(host)) {
      matchedProvider = entry.provider;
      break;
    }
  }

  if (!matchedProvider) {
    return {
      allowed: false,
      error: `Domain ${host} tidak diizinkan. Domain yang diizinkan: ${EMBED_WHITELIST_DOMAIN_ONLY.join(", ")}`,
    };
  }

  // Normalisasi URL ke format embed resmi
  const normalizedUrl = normalizeEmbedUrl(parsed, matchedProvider);

  return { allowed: true, provider: matchedProvider, normalizedUrl };
}

function normalizeEmbedUrl(url: URL, provider: string): string {
  const host = url.hostname.toLowerCase();

  if (provider === "youtube") {
    // YouTube: watch?v= → embed/
    const videoId = url.searchParams.get("v");
    if (videoId) {
      return `https://www.youtube-nocookie.com/embed/${videoId}`;
    }
    // Short URL youtu.be
    if (host === "youtu.be" || host === "www.youtu.be") {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : url.toString();
    }
  }

  if (provider === "google_form") {
    // Google Form: /edit → /viewform?embedded=true
    let path = url.pathname;
    if (path.endsWith("/edit")) {
      path = path.replace(/\/edit$/, "/viewform");
      return `${url.origin}${path}?embedded=true`;
    }
    if (!path.includes("/viewform")) {
      return `${url.origin}${path}/viewform?embedded=true`;
    }
    if (!url.searchParams.has("embedded")) {
      return `${url.origin}${path}?embedded=true`;
    }
  }

  if (provider === "tally") {
    // Tally: /form/ → /embed/
    if (!url.pathname.includes("/embed/")) {
      const path = url.pathname.replace(/\/form\//, "/embed/");
      return `${url.origin}${path}`;
    }
  }

  return url.toString();
}

// ═══════════════════════════════════════════════
// Escape HTML entities untuk mencegah XSS pada markdown/callout
// ═══════════════════════════════════════════════

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
