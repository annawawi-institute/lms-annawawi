// src/index.ts — LMS Annawawi main entry point
import { Hono } from "hono";
import { logger } from "hono/logger";
import { html } from "hono/html";
import { createAuth } from "./lib/auth";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());

// Helper: get auth instance from request context
const getAuth = (env: Env) => createAuth(env);

// Auth session helper
async function getSessionUser(c: any) {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user ?? null;
}

// ═══════════════════════════════════════════════
// Auth routes
// ═══════════════════════════════════════════════

app.on(["GET", "POST"], "/api/auth/*", (c) => {
  return getAuth(c.env).handler(c.req.raw);
});

app.get("/login", (c) => {
  return c.html(html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Masuk — LMS Annawawi</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="container">
    <header><h1>Masuk</h1></header>
    <main>
      <div class="card">
        <h2>Login</h2>
        <p>Gunakan akun Google Anda untuk masuk ke LMS Annawawi.</p>
        <div class="actions">
          <a href="/api/auth/sign-in/google" class="btn btn-primary">Masuk dengan Google</a>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`);
});

// ═══════════════════════════════════════════════
// Dashboard (auth required)
// ═══════════════════════════════════════════════

app.get("/dashboard", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.redirect("/login");
  return c.html(html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard — LMS Annawawi</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="container">
    <header>
      <h1>Dashboard</h1>
      <p>Selamat datang, ${user.name}!</p>
      <p>Role: <strong>${user.role}</strong></p>
    </header>
    <main>
      <div class="card">
        <h2>Kursus Anda</h2>
        <ul>
          <li><strong>Dokumen AGE</strong> — Pembukaan</li>
        </ul>
      </div>
      <div class="card">
        <h2>Akun</h2>
        <p>Email: ${user.email}</p>
        <div class="actions">
          <form method="POST" action="/api/auth/sign-out">
            <button type="submit" class="btn">Keluar</button>
          </form>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`);
});

// ═══════════════════════════════════════════════
// Admin routes (admin only)
// ═══════════════════════════════════════════════

app.get("/admin", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.redirect("/login");
  if (user.role !== "admin")
    return c.html(
      html`<p>Anda tidak punya akses. <a href="/dashboard">Kembali</a></p>`,
      403
    );
  return c.html(html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin — LMS Annawawi</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="container">
    <header>
      <h1>Admin</h1>
      <p>Panel administrasi LMS</p>
    </header>
    <main>
      <div class="card">
        <h2>Manajemen</h2>
        <ul>
          <li><strong>User</strong> — Kelola akun pengguna</li>
          <li><strong>Kursus</strong> — Kelola kursus & materi</li>
          <li><strong>Rombel</strong> — Kelola kelas & anggota</li>
        </ul>
      </div>
      <a href="/dashboard" class="btn">Kembali ke Dashboard</a>
    </main>
  </div>
</body>
</html>`);
});

// ═══════════════════════════════════════════════
// Public routes
// ═══════════════════════════════════════════════

app.get("/", (c) => {
  return c.html(html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LMS Annawawi</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="container">
    <header>
      <h1>LMS Annawawi</h1>
      <p>Platform pembelajaran ringan berbasis Cloudflare</p>
    </header>
    <main>
      <div class="card">
        <h2>Selamat Datang</h2>
        <p>LMS sederhana untuk pengelolaan kursus, materi, dan progress tracking.</p>
        <div class="actions">
          <a href="/login" class="btn btn-primary">Masuk</a>
        </div>
      </div>
      <div class="card">
        <h3>Kursus Tersedia</h3>
        <ul>
          <li><strong>Dokumen AGE</strong> — Pembukaan</li>
        </ul>
      </div>
    </main>
    <footer>
      <p>© 2026 Annawawi Institute</p>
    </footer>
  </div>
</body>
</html>`);
});

// API health check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    app: "LMS Annawawi",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════
// 404
// ═══════════════════════════════════════════════

app.notFound((c) => {
  return c.html(html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>404 — LMS Annawawi</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>Halaman tidak ditemukan.</p>
    <a href="/" class="btn">Kembali</a>
  </div>
</body>
</html>`);
});

// ═══════════════════════════════════════════════
// Error handler
// ═══════════════════════════════════════════════

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_server_error" }, 500);
});

export default app;
