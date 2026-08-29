// src/routes/rombels.ts — CRUD Rombel + Provisi Otomatis + Join Code
import { Hono } from "hono";
import { html } from "hono/html";
import { createAuth } from "../lib/auth";

export const rombelRoutes = new Hono<{ Bindings: Env }>();

async function getUser(c: any) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user ?? null;
}

function requireAdminOrGuru(c: any) {
  const user = c.state.user;
  if (!user) return c.redirect("/login");
  if (user.role === "siswa") return c.redirect("/dashboard");
}

// ═══════════════════════════════════════════════
// Helper: Provisi otomatis rombel → enrollments
// ═══════════════════════════════════════════════
async function syncRombelEnrollments(env: any, groupId: string) {
  const members = await env.DB.prepare(
    "SELECT user_id FROM class_group_members WHERE group_id = ?"
  ).bind(groupId).all();

  const courses = await env.DB.prepare(
    "SELECT course_id FROM class_group_courses WHERE group_id = ?"
  ).bind(groupId).all();

  for (const m of members.results) {
    for (const c of courses.results) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO enrollments (course_id, user_id, source, enrolled_by, enrolled_at) VALUES (?, ?, 'rombel', 'system', ?)"
      ).bind(c.course_id, m.user_id, Date.now()).run();
    }
  }
}

// ═══════════════════════════════════════════════
// Admin: List Rombel
// ═══════════════════════════════════════════════

rombelRoutes.get("/admin/rombels", async (c) => {
  const user = await getUser(c);
  if (!user) return c.redirect("/login");
  if (user.role === "siswa") return c.redirect("/dashboard");

  const groups = await c.env.DB.prepare(
    "SELECT cg.*, COUNT(DISTINCT cgm.user_id) as member_count, COUNT(DISTINCT cgc.course_id) as course_count FROM class_groups cg LEFT JOIN class_group_members cgm ON cgm.group_id = cg.id LEFT JOIN class_group_courses cgc ON cgc.group_id = cg.id GROUP BY cg.id ORDER BY cg.name"
  ).all();

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Rombel — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>Kelola Rombel</h1><a href="/admin" class="btn btn-sm">Kembali</a></header>
  <main>
    <div class="card">
      <div class="card-header"><h2>Daftar Rombel</h2><a href="/admin/rombels/new" class="btn btn-primary btn-sm">+ Rombel Baru</a></div>
      <table>
        <thead><tr><th>Nama</th><th>Tahun Ajaran</th><th>Anggota</th><th>Kursus</th><th>Aksi</th></tr></thead>
        <tbody>
          ${groups.results.map((g: any) => html`<tr>
            <td>${g.name}</td>
            <td>${g.tahun_ajaran || "-"}</td>
            <td>${g.member_count}</td>
            <td>${g.course_count}</td>
            <td><a href="/admin/rombels/${g.id}" class="btn btn-sm">Kelola</a></td>
          </tr>`)}
        </tbody>
      </table>
    </div>
  </main>
</div></body></html>`);
});

// ═══════════════════════════════════════════════
// Admin: Form tambah rombel
// ═══════════════════════════════════════════════

rombelRoutes.get("/admin/rombels/new", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.redirect("/dashboard");
  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Rombel Baru — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container"><header><h1>Rombel Baru</h1></header><main>
<form method="POST" action="/api/rombels">
  <div class="form-group"><label>Nama Rombel</label><input name="name" required></div>
  <div class="form-group"><label>Tahun Ajaran</label><input name="tahun_ajaran" placeholder="2026/2027"></div>
  <button type="submit" class="btn btn-primary">Simpan</button>
</form>
</main></div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Create rombel
// ═══════════════════════════════════════════════

rombelRoutes.post("/api/rombels", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const form = await c.req.parseBody();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO class_groups (id, name, tahun_ajaran) VALUES (?, ?, ?)"
  ).bind(id, form.name, form.tahun_ajaran || null).run();
  return c.redirect("/admin/rombels");
});

// ═══════════════════════════════════════════════
// Admin: Detail rombel (anggota + kursus)
// ═══════════════════════════════════════════════

rombelRoutes.get("/admin/rombels/:id", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.redirect("/dashboard");
  const id = c.req.param("id");

  const group = await c.env.DB.prepare("SELECT * FROM class_groups WHERE id = ?").bind(id).first();
  if (!group) return c.html(html`<h1>404</h1>`, 404);

  const members = await c.env.DB.prepare(
    "SELECT u.id, u.name, u.email FROM class_group_members cgm JOIN user u ON u.id = cgm.user_id WHERE cgm.group_id = ?"
  ).bind(id).all();

  const assignedCourses = await c.env.DB.prepare(
    "SELECT c.id, c.title, c.slug FROM class_group_courses cgc JOIN courses c ON c.id = cgc.course_id WHERE cgc.group_id = ?"
  ).bind(id).all();

  const allCourses = await c.env.DB.prepare(
    "SELECT id, title FROM courses WHERE status = 'published' ORDER BY title"
  ).all();

  const allUsers = await c.env.DB.prepare(
    "SELECT id, name, email FROM user WHERE role = 'siswa' ORDER BY name"
  ).all();

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>${group.name} — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>${group.name}</h1><a href="/admin/rombels" class="btn btn-sm">Kembali</a></header>
  <main>
    <div class="card">
      <div class="card-header"><h2>Tahun Ajaran: ${group.tahun_ajaran || "-"}</h2></div>
    </div>

    <div class="card">
      <div class="card-header"><h2>Anggota (${members.results.length})</h2></div>
      <table>
        <thead><tr><th>Nama</th><th>Email</th><th>Aksi</th></tr></thead>
        <tbody>
          ${members.results.map((m: any) => html`<tr>
            <td>${m.name}</td><td>${m.email}</td>
            <td>
              <form method="POST" action="/api/rombels/${id}/members/remove" style="display:inline">
                <input type="hidden" name="user_id" value="${m.id}">
                <button class="btn btn-sm btn-danger" onclick="return confirm('Keluarkan?')">Keluarkan</button>
              </form>
            </td>
          </tr>`)}
        </tbody>
      </table>
      <form method="POST" action="/api/rombels/${id}/members/add" style="margin-top:1rem">
        <div class="form-group"><label>Tambah Siswa</label>
          <select name="user_id" required>
            <option value="">Pilih siswa...</option>
            ${allUsers.results.map((u: any) => html`<option value="${u.id}">${u.name} (${u.email})</option>`)}
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">Tambah</button>
      </form>
    </div>

    <div class="card">
      <div class="card-header"><h2>Kursus Di-assign (${assignedCourses.results.length})</h2></div>
      <table>
        <thead><tr><th>Kursus</th><th>Aksi</th></tr></thead>
        <tbody>
          ${assignedCourses.results.map((co: any) => html`<tr>
            <td>${co.title}</td>
            <td>
              <form method="POST" action="/api/rombels/${id}/courses/remove" style="display:inline">
                <input type="hidden" name="course_id" value="${co.id}">
                <button class="btn btn-sm btn-danger" onclick="return confirm('Hapus dari rombel? Enrollment rombel juga akan terhapus.')">Hapus</button>
              </form>
            </td>
          </tr>`)}
        </tbody>
      </table>
      <form method="POST" action="/api/rombels/${id}/courses/add" style="margin-top:1rem">
        <div class="form-group"><label>Assign Kursus</label>
          <select name="course_id" required>
            <option value="">Pilih kursus...</option>
            ${allCourses.results.map((co: any) => html`<option value="${co.id}">${co.title}</option>`)}
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">Assign & Provisi</button>
      </form>
    </div>
  </main>
</div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Tambah anggota rombel
// ═══════════════════════════════════════════════

rombelRoutes.post("/api/rombels/:id/members/add", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const groupId = c.req.param("id");
  const form = await c.req.parseBody();
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO class_group_members (group_id, user_id) VALUES (?, ?)"
  ).bind(groupId, form.user_id).run();

  // Auto-provisi enrollment
  await syncRombelEnrollments(c.env, groupId);

  return c.redirect(`/admin/rombels/${groupId}`);
});

// ═══════════════════════════════════════════════
// API: Keluarkan anggota rombel
// ═══════════════════════════════════════════════

rombelRoutes.post("/api/rombels/:id/members/remove", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const groupId = c.req.param("id");
  const form = await c.req.parseBody();
  await c.env.DB.prepare(
    "DELETE FROM class_group_members WHERE group_id = ? AND user_id = ?"
  ).bind(groupId, form.user_id).run();

  // Hapus enrollment rombel yang tidak relevan
  await c.env.DB.prepare(
    "DELETE FROM enrollments WHERE user_id = ? AND source = 'rombel' AND course_id IN (SELECT course_id FROM class_group_courses WHERE group_id = ?)"
  ).bind(form.user_id, groupId).run();

  return c.redirect(`/admin/rombels/${groupId}`);
});

// ═══════════════════════════════════════════════
// API: Assign kursus ke rombel
// ═══════════════════════════════════════════════

rombelRoutes.post("/api/rombels/:id/courses/add", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const groupId = c.req.param("id");
  const form = await c.req.parseBody();
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO class_group_courses (group_id, course_id) VALUES (?, ?)"
  ).bind(groupId, form.course_id).run();

  // Auto-provisi enrollment untuk semua anggota
  await syncRombelEnrollments(c.env, groupId);

  return c.redirect(`/admin/rombels/${groupId}`);
});

// ═══════════════════════════════════════════════
// API: Hapus kursus dari rombel
// ═══════════════════════════════════════════════

rombelRoutes.post("/api/rombels/:id/courses/remove", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const groupId = c.req.param("id");
  const form = await c.req.parseBody();
  await c.env.DB.prepare(
    "DELETE FROM class_group_courses WHERE group_id = ? AND course_id = ?"
  ).bind(groupId, form.course_id).run();

  // Hapus enrollment rombel untuk kursus ini
  await c.env.DB.prepare(
    "DELETE FROM enrollments WHERE source = 'rombel' AND course_id = ? AND user_id IN (SELECT user_id FROM class_group_members WHERE group_id = ?)"
  ).bind(form.course_id, groupId).run();

  return c.redirect(`/admin/rombels/${groupId}`);
});

// ═══════════════════════════════════════════════
// Siswa: Join pakai kode
// ═══════════════════════════════════════════════

rombelRoutes.post("/api/join-with-code", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const form = await c.req.parseBody();
  const code = (form.join_code as string).trim().toUpperCase();

  const course = await c.env.DB.prepare(
    "SELECT * FROM courses WHERE UPPER(join_code) = ? AND status = 'published'"
  ).bind(code).first();

  if (!course) return c.html(html`<script>alert('Kode tidak valid.'); window.history.back();</script>`);

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO enrollments (course_id, user_id, source, enrolled_by, enrolled_at) VALUES (?, ?, 'join_code', ?, ?)"
  ).bind(course.id, user.id, user.id, Date.now()).run();

  return c.redirect(`/c/${course.slug}`);
});

// ═══════════════════════════════════════════════
// Siswa: Form join code
// ═══════════════════════════════════════════════

rombelRoutes.get("/join", async (c) => {
  const user = await getUser(c);
  if (!user) return c.redirect("/login");
  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Gabung Kursus — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container"><header><h1>Gabung Kursus</h1><a href="/dashboard" class="btn btn-sm">Kembali</a></header><main>
<form method="POST" action="/api/join-with-code">
  <div class="form-group"><label>Kode Join</label><input name="join_code" required placeholder="Masukkan kode dari guru..."></div>
  <button type="submit" class="btn btn-primary">Gabung</button>
</form>
</main></div></body></html>`);
});
