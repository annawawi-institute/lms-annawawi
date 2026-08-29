// src/routes/courses.ts — Course CRUD API + Admin UI
import { Hono } from "hono";
import { html } from "hono/html";
import { createAuth } from "../lib/auth";
import { isEmbedAllowed, escapeHtml } from "../lib/embed";
import { parseBody, courseSchema, lessonSchema, blockSchema } from "../lib/validations";

export const courseRoutes = new Hono<{ Bindings: Env }>();

async function getUser(c: any) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user ?? null;
}

// ═══════════════════════════════════════════════
// API: List courses (public published)
// ═══════════════════════════════════════════════

courseRoutes.get("/api/courses", async (c) => {
  const courses = await c.env.DB.prepare(
    "SELECT * FROM courses WHERE status='published' ORDER BY created_at DESC"
  ).all();
  return c.json(courses.results);
});

// ═══════════════════════════════════════════════
// API: Get course detail
// ═══════════════════════════════════════════════

courseRoutes.get("/api/courses/:slug", async (c) => {
  const slug = c.req.param("slug");
  const course = await c.env.DB.prepare(
    "SELECT * FROM courses WHERE slug = ?"
  ).bind(slug).first();
  if (!course) return c.json({ error: "not found" }, 404);

  const lessons = await c.env.DB.prepare(
    "SELECT * FROM lessons WHERE course_id = ? ORDER BY position"
  ).bind(course.id).all();

  return c.json({ ...course, lessons: lessons.results });
});

// ═══════════════════════════════════════════════
// Admin: Course list
// ═══════════════════════════════════════════════

courseRoutes.get("/admin/courses", async (c) => {
  const user = await getUser(c);
  if (!user) return c.redirect("/login");
  if (user.role === "siswa") return c.redirect("/dashboard");

  const courses = await c.env.DB.prepare(
    "SELECT c.*, COUNT(DISTINCT e.user_id) as student_count FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id GROUP BY c.id ORDER BY c.created_at DESC"
  ).all();

  return c.html(html`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kelola Kursus — LMS Annawawi</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="container">
    <header>
      <h1>Kelola Kursus</h1>
      <a href="/admin" class="btn btn-sm">Kembali</a>
    </header>
    <main>
      <div class="card">
        <div class="card-header">
          <h2>Daftar Kursus</h2>
          <a href="/admin/courses/new" class="btn btn-primary btn-sm">+ Kursus Baru</a>
        </div>
        <table>
          <thead>
            <tr><th>Judul</th><th>Slug</th><th>Status</th><th>Siswa</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            ${courses.results.map((co: any) => html`<tr>
              <td>${co.title}</td>
              <td><code>${co.slug}</code></td>
              <td><span class="badge badge-${co.status === 'published' ? 'success' : 'warning'}">${co.status}</span></td>
              <td>${co.student_count}</td>
              <td>
                <a href="/admin/courses/${co.slug}/edit" class="btn btn-sm">Edit</a>
                <a href="/c/${co.slug}" class="btn btn-sm" target="_blank">Lihat</a>
              </td>
            </tr>`)}
          </tbody>
        </table>
      </div>
    </main>
  </div>
</body>
</html>`);
});

// ═══════════════════════════════════════════════
// Admin: Create course form
// ═══════════════════════════════════════════════

courseRoutes.get("/admin/courses/new", async (c) => {
  const user = await getUser(c);
  if (!user) return c.redirect("/login");
  if (user.role === "siswa") return c.redirect("/dashboard");
  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Kursus Baru — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container"><header><h1>Kursus Baru</h1></header><main>
<form method="POST" action="/api/courses">
  <div class="form-group"><label>Judul</label><input name="title" required></div>
  <div class="form-group"><label>Slug</label><input name="slug" required pattern="[a-z0-9-]+"></div>
  <div class="form-group"><label>Deskripsi</label><textarea name="description" rows="3"></textarea></div>
  <div class="form-group"><label>Status</label><select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></div>
  <div class="actions"><button type="submit" class="btn btn-primary">Simpan</button><a href="/admin/courses" class="btn">Batal</a></div>
</form>
</main></div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Create course
// ═══════════════════════════════════════════════

courseRoutes.post("/api/courses", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  if (user.role === "siswa") return c.json({ error: "forbidden" }, 403);

  const form = await c.req.parseBody();
  const parsed = parseBody(courseSchema, form as any);
  if (!parsed.success) return c.json({ error: "validation", details: parsed.errors }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO courses (id, title, slug, description, status, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, parsed.data.title, parsed.data.slug, parsed.data.description, parsed.data.status, user.id).run();

  return c.redirect(`/admin/courses`);
});

// ═══════════════════════════════════════════════
// Admin: Edit course form
// ═══════════════════════════════════════════════

courseRoutes.get("/admin/courses/:slug/edit", async (c) => {
  const user = await getUser(c);
  if (!user) return c.redirect("/login");
  if (user.role === "siswa") return c.redirect("/dashboard");

  const slug = c.req.param("slug");
  const course = await c.env.DB.prepare("SELECT * FROM courses WHERE slug = ?").bind(slug).first();
  if (!course) return c.json({ error: "not found" }, 404);

  const lessons = await c.env.DB.prepare("SELECT * FROM lessons WHERE course_id = ? ORDER BY position").bind(course.id).all();

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Edit ${course.title} — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
<header><h1>Edit: ${course.title}</h1><a href="/admin/courses" class="btn btn-sm">Kembali</a></header>
<main>
  <form method="POST" action="/api/courses/${slug}/update" style="margin-bottom:2rem">
    <div class="form-group"><label>Judul</label><input name="title" value="${course.title}" required></div>
    <div class="form-group"><label>Deskripsi</label><textarea name="description" rows="3">${course.description}</textarea></div>
    <div class="form-group"><label>Status</label><select name="status"><option value="draft" ${course.status==='draft'?'selected':''}>Draft</option><option value="published" ${course.status==='published'?'selected':''}>Published</option><option value="archived" ${course.status==='archived'?'selected':''}>Archived</option></select></div>
    <button type="submit" class="btn btn-primary">Simpan</button>
  </form>

  <div class="card">
    <div class="card-header"><h2>Pelajaran</h2><a href="/admin/courses/${slug}/lessons/new" class="btn btn-primary btn-sm">+ Pelajaran Baru</a></div>
    <table>
      <thead><tr><th>No</th><th>Judul</th><th>Status</th><th>Blok</th><th>Aksi</th></tr></thead>
      <tbody>
        ${lessons.results.map((le: any) => html`<tr>
          <td>${le.position + 1}</td><td>${le.title}</td><td><span class="badge badge-${le.status==='published'?'success':'warning'}">${le.status}</span></td>
          <td>—</td>
          <td><a href="/admin/courses/${slug}/lessons/${le.id}/edit" class="btn btn-sm">Edit</a></td>
        </tr>`)}
      </tbody>
    </table>
  </div>
</main></div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Update course
// ═══════════════════════════════════════════════

courseRoutes.post("/api/courses/:slug/update", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const slug = c.req.param("slug");
  const form = await c.req.parseBody();
  await c.env.DB.prepare("UPDATE courses SET title = ?, description = ?, status = ?, updated_at = ? WHERE slug = ?")
    .bind(form.title, form.description || "", form.status || "draft", Date.now(), slug).run();
  return c.redirect(`/admin/courses/${slug}/edit`);
});

// ═══════════════════════════════════════════════
// Admin: Create lesson form
// ═══════════════════════════════════════════════

courseRoutes.get("/admin/courses/:slug/lessons/new", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.redirect("/dashboard");
  const course = await c.env.DB.prepare("SELECT * FROM courses WHERE slug = ?").bind(c.req.param("slug")).first();
  if (!course) return c.json({ error: "not found" }, 404);
  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Pelajaran Baru — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container"><header><h1>Pelajara Baru: ${course.title}</h1></header><main>
<form method="POST" action="/api/courses/${course.slug}/lessons">
  <div class="form-group"><label>Judul Pelajaran</label><input name="title" required></div>
  <div class="form-group"><label>Status</label><select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></div>
  <button type="submit" class="btn btn-primary">Simpan</button>
</form>
</main></div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Create lesson
// ═══════════════════════════════════════════════

courseRoutes.post("/api/courses/:slug/lessons", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const course = await c.env.DB.prepare("SELECT * FROM courses WHERE slug = ?").bind(c.req.param("slug")).first();
  if (!course) return c.json({ error: "not found" }, 404);
  const form = await c.req.parseBody();
  const parsed = parseBody(lessonSchema, form as any);
  if (!parsed.success) return c.json({ error: "validation", details: parsed.errors }, 400);
  const id = crypto.randomUUID();
  const maxPos = await c.env.DB.prepare("SELECT MAX(position) as pos FROM lessons WHERE course_id = ?").bind(course.id).first();
  const pos = ((maxPos?.pos ?? -1) + 1);
  await c.env.DB.prepare("INSERT INTO lessons (id, course_id, title, position, status) VALUES (?, ?, ?, ?, ?)")
    .bind(id, course.id, parsed.data.title, pos, parsed.data.status).run();
  return c.redirect(`/admin/courses/${course.slug}/edit`);
});

// ═══════════════════════════════════════════════
// Admin: Edit lesson + blocks
// ═══════════════════════════════════════════════

courseRoutes.get("/admin/courses/:slug/lessons/:lessonId/edit", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.redirect("/dashboard");
  const { slug, lessonId } = c.req.param();
  const course = await c.env.DB.prepare("SELECT * FROM courses WHERE slug = ?").bind(slug).first();
  const lesson = await c.env.DB.prepare("SELECT * FROM lessons WHERE id = ?").bind(lessonId).first();
  if (!course || !lesson) return c.json({ error: "not found" }, 404);
  const blocks = await c.env.DB.prepare("SELECT * FROM lesson_blocks WHERE lesson_id = ? ORDER BY position").bind(lessonId).all();

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Edit ${lesson.title} — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container"><header><h1>Edit: ${lesson.title}</h1><a href="/admin/courses/${slug}/edit" class="btn btn-sm">Kembali</a></header><main>
  <form method="POST" action="/api/lessons/${lessonId}/update" style="margin-bottom:2rem">
    <div class="form-group"><label>Judul</label><input name="title" value="${lesson.title}" required></div>
    <div class="form-group"><label>Status</label><select name="status"><option value="draft" ${lesson.status==='draft'?'selected':''}>Draft</option><option value="published" ${lesson.status==='published'?'selected':''}>Published</option></select></div>
    <button type="submit" class="btn btn-primary">Simpan</button>
  </form>

  <div class="card">
    <div class="card-header"><h2>Blok Materi</h2><button class="btn btn-primary btn-sm" onclick="addBlock()">+ Blok Baru</button></div>
    <div id="blocks">
      ${blocks.results.map((b: any) => html`<div class="block-item card">
        <strong>${b.type}${b.provider ? " (" + b.provider + ")" : ""}</strong>
        ${b.url ? html`<br><small><a href="${b.url}" target="_blank">${b.url}</a></small>` : ""}
        <div class="actions"><button class="btn btn-sm" onclick="editBlock('${b.id}')">Edit</button></button></div>
      </div>`)}
    </div>
  </div>

  <!-- Add block modal -->
  <div id="block-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:100; justify-content:center; align-items:center;">
    <div class="card" style="max-width:500px; width:90%;">
      <h3 id="modal-title">Blok Baru</h3>
      <form id="block-form" method="POST">
        <input type="hidden" name="block_id" id="block-id">
        <div class="form-group"><label>Tipe</label>
          <select name="type" id="block-type" onchange="toggleProvider()">
            <option value="markdown">Markdown</option>
            <option value="embed">Embed</option>
            <option value="file">File (R2)</option>
            <option value="callout">Callout</option>
          </select>
        </div>
        <div class="form-group" id="provider-group" style="display:none"><label>Provider</label>
          <select name="provider" id="block-provider">
            <option value="youtube">YouTube</option>
            <option value="tally">Tally</option>
            <option value="google_form">Google Form</option>
            <option value="r2_pdf">PDF (R2)</option>
          </select>
        </div>
        <div class="form-group"><label>URL / Konten</label><textarea name="url" id="block-url" rows="3" placeholder="URL embed atau teks markdown..."></textarea></div>
        <div class="actions"><button type="submit" class="btn btn-primary">Simpan</button><button type="button" class="btn" onclick="closeModal()">Batal</button></div>
      </form>
    </div>
  </div>

  <script>
    function toggleProvider() {
      const type = document.getElementById('block-type').value;
      document.getElementById('provider-group').style.display = type === 'embed' ? 'block' : 'none';
    }
    function addBlock() {
      document.getElementById('modal-title').textContent = 'Blok Baru';
      document.getElementById('block-id').value = '';
      document.getElementById('block-form').action = '/api/lessons/${lessonId}/blocks';
      document.getElementById('block-modal').style.display = 'flex';
    }
    function editBlock(id) {
      document.getElementById('modal-title').textContent = 'Edit Blok';
      document.getElementById('block-id').value = id;
      document.getElementById('block-form').action = '/api/blocks/' + id + '/update';
      document.getElementById('block-modal').style.display = 'flex';
    }
    function closeModal() { document.getElementById('block-modal').style.display = 'none'; }
  </script>
</main></div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Update lesson
// ═══════════════════════════════════════════════

courseRoutes.post("/api/lessons/:id/update", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  await c.env.DB.prepare("UPDATE lessons SET title = ?, status = ? WHERE id = ?").bind(form.title, form.status || "draft", id).run();
  const lesson = await c.env.DB.prepare("SELECT course_id FROM lessons WHERE id = ?").bind(id).first();
  const course = await c.env.DB.prepare("SELECT slug FROM courses WHERE id = ?").bind(lesson.course_id).first();
  return c.redirect(`/admin/courses/${course.slug}/lessons/${id}/edit`);
});

// ═══════════════════════════════════════════════
// API: Add block to lesson
// ═══════════════════════════════════════════════

courseRoutes.post("/api/lessons/:id/blocks", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const lessonId = c.req.param("id");
  const form = await c.req.parseBody();
  const id = crypto.randomUUID();
  const maxPos = await c.env.DB.prepare("SELECT MAX(position) as pos FROM lesson_blocks WHERE lesson_id = ?").bind(lessonId).first();
  const pos = ((maxPos?.pos ?? -1) + 1);

  const type = form.type as string;
  let url = (form.url as string) || "";
  const provider = form.provider as string | null;

  // Validate embed URL against whitelist
  if (type === "embed" && url) {
    const check = isEmbedAllowed(url);
    if (!check.allowed) return c.json({ error: check.error }, 400);
    url = check.normalizedUrl || url;
    // Use detected provider if not explicitly set
    await c.env.DB.prepare("INSERT INTO lesson_blocks (id, lesson_id, type, provider, url, position) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, lessonId, type, provider || check.provider || null, url, pos).run();
  } else {
    await c.env.DB.prepare("INSERT INTO lesson_blocks (id, lesson_id, type, provider, url, position) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, lessonId, type, provider || null, url, pos).run();
  }

  return c.json({ success: true, id });
});

// ═══════════════════════════════════════════════
// API: Update block
// ═══════════════════════════════════════════════

courseRoutes.post("/api/blocks/:id/update", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  const type = form.type as string;
  let url = (form.url as string) || "";
  const provider = form.provider as string | null;

  if (type === "embed" && url) {
    const check = isEmbedAllowed(url);
    if (!check.allowed) return c.json({ error: check.error }, 400);
    url = check.normalizedUrl || url;
  }

  await c.env.DB.prepare("UPDATE lesson_blocks SET type = ?, provider = ?, url = ? WHERE id = ?")
    .bind(type, provider || null, url, id).run();
  return c.json({ success: true });
});

// ═══════════════════════════════════════════════
// Public: View course (student)
// ═══════════════════════════════════════════════

courseRoutes.get("/c/:slug", async (c) => {
  const slug = c.req.param("slug");
  const course = await c.env.DB.prepare("SELECT * FROM courses WHERE slug = ? AND status = 'published'").bind(slug).first();
  if (!course) return c.html(html`<!DOCTYPE html><html><body><h1>404</h1><a href="/">Kembali</a></body></html>`, 404);

  const user = await getUser(c);
  let enrolled = false;
  if (user) {
    const enr = await c.env.DB.prepare("SELECT 1 FROM enrollments WHERE course_id = ? AND user_id = ?").bind(course.id, user.id).first();
    enrolled = !!enr;
  }

  const lessons = await c.env.DB.prepare("SELECT * FROM lessons WHERE course_id = ? AND status = 'published' ORDER BY position").bind(course.id).all();

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>${course.title} — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container"><header><h1>${course.title}</h1><a href="/" class="btn btn-sm">Beranda</a></header>
<main>
  <div class="card"><p>${course.description || ""}</p>
    ${!enrolled && user ? html`<form method="POST" action="/api/enroll"><input type="hidden" name="course_id" value="${course.id}"><button class="btn btn-primary" type="submit">Gabung Kursus</button></form>` : ""}
    ${enrolled ? html`<span class="badge badge-success">Terdaftar</span>` : ""}
    ${!user ? html`<a href="/login" class="btn btn-primary">Masuk untuk Bergabung</a>` : ""}
  </div>
  <div class="card"><h2>Pelajaran</h2><ol>
    ${lessons.results.map((le: any) => html`<li><a href="/c/${slug}/lessons/${le.id}">${le.title}</a></li>`)}
  </ol></div>
</main></div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Enroll (manual)
// ═══════════════════════════════════════════════

courseRoutes.post("/api/enroll", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const form = await c.req.parseBody();
  const courseId = form.course_id as string;
  await c.env.DB.prepare("INSERT OR IGNORE INTO enrollments (course_id, user_id, source, enrolled_by) VALUES (?, ?, 'manual', ?)")
    .bind(courseId, user.id, user.id).run();
  const course = await c.env.DB.prepare("SELECT slug FROM courses WHERE id = ?").bind(courseId).first();
  return c.redirect(`/c/${course.slug}`);
});

// ═══════════════════════════════════════════════
// Student: View lesson with blocks
// ═══════════════════════════════════════════════

courseRoutes.get("/c/:slug/lessons/:lessonId", async (c) => {
  const { slug, lessonId } = c.req.param();
  const course = await c.env.DB.prepare("SELECT * FROM courses WHERE slug = ?").bind(slug).first();
  const lesson = await c.env.DB.prepare("SELECT * FROM lessons WHERE id = ? AND status = 'published'").bind(lessonId).first();
  if (!course || !lesson) return c.html(html`<h1>404</h1>`, 404);

  const blocks = await c.env.DB.prepare("SELECT * FROM lesson_blocks WHERE lesson_id = ? ORDER BY position").bind(lessonId).all();
  const user = await getUser(c);
  let completed = false;
  if (user) {
    const prog = await c.env.DB.prepare("SELECT status FROM progress WHERE user_id = ? AND lesson_id = ?").bind(user.id, lessonId).first();
    completed = prog?.status === "done";
  }

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>${lesson.title} — ${course.title}</title>
<link rel="stylesheet" href="/styles.css">
<style>.embed-wrap{position:relative; padding-bottom:56.25%; height:0; overflow:hidden; margin:1rem 0} .embed-wrap iframe{position:absolute; top:0; left:0; width:100%; height:100%; border:0}</style>
</head>
<body><div class="container"><header><h1>${course.title}</h1><a href="/c/${slug}" class="btn btn-sm">Kembali</a></header>
<main>
  <h2>${lesson.title}</h2>
  ${blocks.results.map((b: any) => {
    if (b.type === "markdown") return html`<div class="card">${escapeHtml(b.url || "").replace(/\n/g, "<br>")}</div>`;
    if (b.type === "embed" && b.provider === "youtube") return html`<div class="embed-wrap"><iframe src="${b.url}" allowfullscreen loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups"></iframe></div>`;
    if (b.type === "embed" && b.provider === "tally") return html`<div class="embed-wrap"><iframe src="${b.url}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe></div>`;
    if (b.type === "embed" && b.provider === "google_form") return html`<div class="embed-wrap"><iframe src="${b.url}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe></div>`;
    if (b.type === "callout") return html`<div class="card" style="border-left:4px solid var(--primary); padding-left:1rem"><strong>💡 ${escapeHtml(b.url || "").replace(/\n/g, "<br>")}</strong></div>`;
    return html`<div class="card">Unknown block type</div>`;
  })}
  ${user ? html`<form method="POST" action="/api/progress/${lessonId}"><button class="btn btn-primary" type="submit">${completed ? "✓ Selesai" : "Tandai Selesai"}</button></form>` : ""}
</main></div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Mark lesson complete
// ═══════════════════════════════════════════════

courseRoutes.post("/api/progress/:lessonId", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const lessonId = c.req.param("lessonId");
  await c.env.DB.prepare("INSERT OR REPLACE INTO progress (user_id, lesson_id, status, marked_by, updated_at) VALUES (?, ?, 'done', ?, ?)")
    .bind(user.id, lessonId, user.id, Date.now()).run();
  const lesson = await c.env.DB.prepare("SELECT course_id FROM lessons WHERE id = ?").bind(lessonId).first();
  const course = await c.env.DB.prepare("SELECT slug FROM courses WHERE id = ?").bind(lesson.course_id).first();
  return c.redirect(`/c/${course.slug}/lessons/${lessonId}`);
});
