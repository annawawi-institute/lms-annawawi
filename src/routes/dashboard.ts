// src/routes/dashboard.ts — Dashboard Siswa (% progress) & Rekap Guru
import { Hono } from "hono";
import { html } from "hono/html";
import { createAuth } from "../lib/auth";

export const dashboardRoutes = new Hono<{ Bindings: Env }>();

async function getUser(c: any) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user ?? null;
}

// ═══════════════════════════════════════════════
// Dashboard Siswa: list enrolled + progress
// ═══════════════════════════════════════════════

dashboardRoutes.get("/dashboard", async (c) => {
  const user = await getUser(c);
  if (!user) return c.redirect("/login");

  if (user.role === "siswa") {
    // Siswa: enrolled courses + progress
    const enrolled = await c.env.DB.prepare(
      "SELECT c.id, c.title, c.slug, c.description FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? ORDER BY c.title"
    ).bind(user.id).all();

    const courseProgress = [];
    for (const co of enrolled.results) {
      const totalRes = await c.env.DB.prepare(
        "SELECT COUNT(*) as total FROM lessons WHERE course_id = ? AND status = 'published'"
      ).bind(co.id).first();
      const doneRes = await c.env.DB.prepare(
        "SELECT COUNT(*) as done FROM progress p JOIN lessons l ON l.id = p.lesson_id WHERE p.user_id = ? AND l.course_id = ? AND p.status = 'done'"
      ).bind(user.id, co.id).first();
      const total = totalRes?.total || 0;
      const done = doneRes?.done || 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      courseProgress.push({ ...co, total, done, pct });
    }

    return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Dashboard — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>Dashboard</h1><p>Selamat datang, ${user.name}!</p></header>
  <main>
    <div class="card">
      <div class="card-header"><h2>Kursus Anda</h2><a href="/join" class="btn btn-primary btn-sm">+ Gabung Kursus</a></div>
      ${courseProgress.length === 0 ? html`<p>Belum ada kursus. Gabung pakai kode dari guru.</p>` : html`
        <ul class="course-list">
          ${courseProgress.map((co: any) => html`<li class="card">
            <div class="card-header"><h3><a href="/c/${co.slug}">${co.title}</a></h3><span class="badge ${co.pct === 100 ? 'badge-success' : 'badge-info'}">${co.pct}%</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${co.pct}%"></div></div>
            <small>${co.done} dari ${co.total} pelajaran selesai</small>
          </li>`)}
        </ul>
      `}
    </div>
    <div class="card">
      <h2>Akun</h2>
      <p>Email: ${user.email}</p>
      <p>Role: <strong>${user.role}</strong></p>
      <form method="POST" action="/api/auth/sign-out" style="display:inline" id="logout-form">
        <button type="submit" class="btn" id="logout-btn">Keluar</button>
      </form>
      <script>
        document.getElementById("logout-btn").addEventListener("click", async (e) => {
          e.preventDefault();
          await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          window.location.href = "/login";
        });
      </script>
    </div>
  </main>
</div></body></html>`);
  }

  // Guru/Admin: dashboard manajemen
  const courseCount = await c.env.DB.prepare("SELECT COUNT(*) as n FROM courses").first();
  const userCount = await c.env.DB.prepare("SELECT COUNT(*) as n FROM user WHERE role='siswa'").first();
  const groupCount = await c.env.DB.prepare("SELECT COUNT(*) as n FROM class_groups").first();
  const enrollmentCount = await c.env.DB.prepare("SELECT COUNT(*) as n FROM enrollments").first();

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Dashboard — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>Dashboard</h1><p>Selamat datang, ${user.name}!</p></header>
  <main>
    <div class="card">
      <h2>Rekap</h2>
      <div class="stats">
        <div class="stat-card"><strong>${userCount?.n || 0}</strong><span>Siswa</span></div>
        <div class="stat-card"><strong>${courseCount?.n || 0}</strong><span>Kursus</span></div>
        <div class="stat-card"><strong>${groupCount?.n || 0}</strong><span>Rombel</span></div>
        <div class="stat-card"><strong>${enrollmentCount?.n || 0}</strong><span>Enrollment</span></div>
      </div>
    </div>
    <div class="card">
      <h2>Manajemen</h2>
      <ul>
        <li><a href="/admin/courses">Kelola Kursus</a></li>
        <li><a href="/admin/rombels">Kelola Rombel</a></li>
        ${user.role === "admin" ? html`<li><a href="/admin/users">Kelola User</a></li>` : ""}
      </ul>
    </div>
    <div class="card">
      <h2>Akun</h2>
      <p>Email: ${user.email}</p>
      <p>Role: <strong>${user.role}</strong></p>
      <form method="POST" action="/api/auth/sign-out" style="display:inline" id="logout-form">
        <button type="submit" class="btn" id="logout-btn">Keluar</button>
      </form>
      <script>
        document.getElementById("logout-btn").addEventListener("click", async (e) => {
          e.preventDefault();
          await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          window.location.href = "/login";
        });
      </script>
    </div>
  </main>
</div></body></html>`);
});
