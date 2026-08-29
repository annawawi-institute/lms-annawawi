// src/index.ts — LMS Annawawi main entry point
import { Hono } from "hono";
import { logger } from "hono/logger";
import { html } from "hono/html";
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "./lib/auth";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());

// Test route — verify Hono routing works
app.get("/tes", (c) => {
  return c.json({ msg: "hono routing works!", path: c.req.path });
});

// Better Auth — using * (single segment per Better Auth docs)
app.all("/api/auth/*", async (c) => {
  console.log("[AUTH] matched /api/auth/*:", c.req.method, c.req.url);
  try {
    const auth = createAuth(c.env);
    const res = await auth.handler(c.req.raw);
    console.log("[AUTH] handler status:", res.status);
    return res;
  } catch (err: any) {
    console.error("[AUTH ERROR]", err.message);
    return c.json({ error: err.message }, 500);
  }
});

// Migration endpoint
app.post("/migrate", async (c) => {
  try {
    const auth = createAuth(c.env);
    const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
    if (toBeCreated.length === 0 && toBeAdded.length === 0) {
      return c.json({ message: "No migrations needed" });
    }
    await runMigrations();
    return c.json({
      message: "Migrations completed",
      created: toBeCreated.map((t) => t.table),
      added: toBeAdded.map((t) => t.table),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Session helpers
async function getUser(c: any) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user ?? null;
}

// Login page
app.get("/login", async (c) => {
  const user = await getUser(c);
  if (user) return c.redirect("/dashboard");
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
          <button type="submit" id="google-btn" class="btn btn-primary">Masuk dengan Google</button>
        </div>
        <script>
          document.getElementById("google-btn").addEventListener("click", async (e) => {
            e.preventDefault();
            const res = await fetch("/api/auth/sign-in/social", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider: "google" }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert("Error: " + JSON.stringify(data));
          });
        </script>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`);
});

// Dashboard
app.get("/dashboard", async (c) => {
  const user = await getUser(c);
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

// Admin
app.get("/admin", async (c) => {
  const user = await getUser(c);
  if (!user) return c.redirect("/login");
  if (user.role !== "admin")
    return c.html(html`<p>Akses ditolak. <a href="/dashboard">Kembali</a></p>`, 403);
  return c.html(html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Admin — LMS Annawawi</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="container">
    <header><h1>Admin</h1></header>
    <main>
      <div class="card">
        <h2>Manajemen</h2>
        <ul>
          <li><strong>User</strong></li>
          <li><strong>Kursus</strong></li>
          <li><strong>Rombel</strong></li>
        </ul>
      </div>
      <a href="/dashboard" class="btn">Kembali</a>
    </main>
  </div>
</body>
</html>`);
});

// Public routes
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
    <footer><p>© 2026 Annawawi Institute</p></footer>
  </div>
</body>
</html>`);
});

app.get("/api/health", (c) => {
  return c.json({ status: "ok", app: "LMS Annawawi", version: "0.1.0", timestamp: new Date().toISOString() });
});

app.notFound((c) => {
  console.log("[404] Unmatched route:", c.req.method, c.req.url);
  return c.html(html`<!DOCTYPE html><html><head><title>404</title><link rel="stylesheet" href="/styles.css"></head><body><div class="container"><h1>404</h1><p>Halaman tidak ditemukan.</p><a href="/" class="btn">Kembali</a></div></body></html>`, 404);
});

app.onError((err, c) => { console.error(err); return c.json({ error: "internal" }, 500); });

export default app;
