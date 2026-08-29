// src/index.ts — LMS Annawawi main entry point (template strings, no JSX)
import { Hono } from "hono";
import { logger } from "hono/logger";
import { html } from "hono/html";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());

// Auth placeholder routes
const loginPage = () => html`<!DOCTYPE html>
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
        <p>Fitur login akan diaktifkan di milestone M2 (Google OAuth).</p>
        <a href="/" class="btn">Kembali</a>
      </div>
    </main>
  </div>
</body>
</html>`;

const notFoundPage = () => html`<!DOCTYPE html>
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
</html>`;

const errorPage = () => html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Error — LMS Annawawi</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="container">
    <h1>Terjadi Kesalahan</h1>
    <p>Maaf, terjadi kesalahan internal.</p>
    <a href="/" class="btn">Kembali</a>
  </div>
</body>
</html>`;

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
    <footer>
      <p>© 2026 Annawawi Institute</p>
    </footer>
  </div>
</body>
</html>`);
});

app.get("/login", (c) => c.html(loginPage()));

// API health check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    app: "LMS Annawawi",
    version: "0.0.1",
    timestamp: new Date().toISOString(),
  });
});

// 404
app.notFound((c) => c.html(notFoundPage(), 404));

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.html(errorPage(), 500);
});

export default app;
