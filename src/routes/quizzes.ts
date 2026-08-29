// src/routes/quizzes.ts — Quiz Builder (admin) + Render & Score (siswa)
import { Hono } from "hono";
import { html, raw } from "hono/html";
import { createAuth } from "../lib/auth";

export const quizRoutes = new Hono<{ Bindings: Env }>();

async function getUser(c: any) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user ?? null;
}

// ═══════════════════════════════════════════════
// Admin: List quizzes per lesson
// ═══════════════════════════════════════════════

quizRoutes.get("/admin/courses/:courseSlug/lessons/:lessonSlug/quizzes", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.redirect("/login");
  
  const { courseSlug, lessonSlug } = c.req.param();
  
  const lesson = await c.env.DB.prepare(`
    SELECT l.*, c.slug as course_slug, c.title as course_title
    FROM lessons l JOIN courses c ON l.course_id = c.id
    WHERE c.slug = ? AND l.id = ?
  `).bind(courseSlug, lessonSlug).first();
  
  if (!lesson) return c.html(html`<p>Lesson tidak ditemukan.</p>`, 404);
  
  const quizzes = await c.env.DB.prepare(`
    SELECT q.*, COUNT(qq.id) as question_count
    FROM quizzes q LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
    WHERE q.lesson_id = ?
    GROUP BY q.id ORDER BY q.title
  `).bind(lesson.id).all();
  
  const quizRows = quizzes.results.length === 0 
    ? '<tr><td colspan="5">Belum ada kuis.</td></tr>'
    : quizzes.results.map((q: any) => 
        `<tr>
          <td>${q.title}</td>
          <td>${q.question_count || 0}</td>
          <td>${q.pass_score}%</td>
          <td><span class="badge badge-${q.published ? 'success' : 'warning'}">${q.published ? 'Published' : 'Draft'}</span></td>
          <td>
            <a href="/admin/courses/${courseSlug}/lessons/${lessonSlug}/quizzes/${q.id}/edit" class="btn btn-sm">Edit</a>
            <a href="/c/${courseSlug}/lessons/${lessonSlug}/quiz/${q.id}" class="btn btn-sm" target="_blank">Preview</a>
          </td>
        </tr>`
      ).join("");

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Kuis — ${lesson.title}</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>Kuis: ${lesson.title}</h1><a href="/admin/courses/${courseSlug}" class="btn btn-sm">Kembali</a></header>
  <main>
    <div class="card">
      <div class="card-header">
        <h2>Daftar Kuis</h2>
        <a href="/admin/courses/${courseSlug}/lessons/${lessonSlug}/quizzes/new" class="btn btn-primary">+ Kuis Baru</a>
      </div>
      <table>
        <thead><tr><th>Judul</th><th>Soal</th><th>Pass Score</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${raw(quizRows)}</tbody>
      </table>
    </div>
  </main>
</div></body></html>`);
});

// ═══════════════════════════════════════════════
// Admin: Create quiz form
// ═══════════════════════════════════════════════

quizRoutes.get("/admin/courses/:courseSlug/lessons/:lessonSlug/quizzes/new", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.redirect("/login");
  
  const { courseSlug, lessonSlug } = c.req.param();
  
  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Buat Kuis</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>Buat Kuis Baru</h1><a href="/admin/courses/${courseSlug}/lessons/${lessonSlug}/quizzes" class="btn btn-sm">Kembali</a></header>
  <main>
    <div class="card">
      <form method="POST" action="/admin/courses/${courseSlug}/lessons/${lessonSlug}/quizzes">
        <label>Judul Kuis</label>
        <input type="text" name="title" required placeholder="Contoh: Kuis Pembukaan">
        
        <label>Pass Score (%)</label>
        <input type="number" name="pass_score" value="70" min="0" max="100">
        
        <label>Time Limit (detik, 0 = tanpa batas)</label>
        <input type="number" name="time_limit_s" value="0" min="0">
        
        <div class="actions">
          <button type="submit" class="btn btn-primary">Buat Kuis</button>
        </div>
      </form>
    </div>
  </main>
</div></body></html>`);
});

// ═══════════════════════════════════════════════
// Admin: Store new quiz
// ═══════════════════════════════════════════════

quizRoutes.post("/admin/courses/:courseSlug/lessons/:lessonSlug/quizzes", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  
  const { courseSlug, lessonSlug } = c.req.param();
  const form = await c.req.parseBody();
  
  const lesson = await c.env.DB.prepare(
    "SELECT id FROM lessons l JOIN courses c ON l.course_id = c.id WHERE c.slug = ? AND l.id = ?"
  ).bind(courseSlug, lessonSlug).first();
  
  if (!lesson) return c.html(html`<p>Lesson tidak ditemukan.</p>`, 404);
  
  const quizId = `quiz-${Date.now()}`;
  await c.env.DB.prepare(
    "INSERT INTO quizzes (id, lesson_id, title, pass_score, time_limit_s) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    quizId,
    lesson.id,
    form.title,
    parseInt(form.pass_score as string) || 70,
    parseInt(form.time_limit_s as string) || 0
  ).run();
  
  return c.redirect(`/admin/courses/${courseSlug}/lessons/${lessonSlug}/quizzes/${quizId}/edit`);
});

// ═══════════════════════════════════════════════
// Admin: Edit quiz (add questions)
// ═══════════════════════════════════════════════

quizRoutes.get("/admin/courses/:courseSlug/lessons/:lessonSlug/quizzes/:quizId/edit", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.redirect("/login");
  
  const { courseSlug, lessonSlug, quizId } = c.req.param();
  
  const quiz = await c.env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(quizId).first();
  if (!quiz) return c.html(html`<p>Kuis tidak ditemukan.</p>`, 404);
  
  const questions = await c.env.DB.prepare(
    "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position"
  ).bind(quizId).all();
  
  const questionEditHtml = questions.results.map((q: any) => 
    `<div class="card" style="margin:0.5rem 0">
      <p><strong>${q.prompt}</strong></p>
      <ul>
        ${(JSON.parse(q.options) as string[]).map((opt: string, i: number) => 
          `<li class="${(JSON.parse(q.correct_keys) as string[]).includes(String(i)) ? 'text-success' : ''}">${opt}</li>`
        ).join("")}
      </ul>
      <form method="POST" action="/admin/quizzes/${quizId}/questions/${q.id}/delete" style="display:inline">
        <button type="submit" class="btn btn-sm btn-danger">Hapus</button>
      </form>
    </div>`
  ).join("");

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Edit Kuis: ${quiz.title}</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>Edit Kuis: ${quiz.title}</h1><a href="/admin/courses/${courseSlug}/lessons/${lessonSlug}/quizzes" class="btn btn-sm">Kembali</a></header>
  <main>
    <div class="card">
      <h2>Soal-soal</h2>
      ${raw(questionEditHtml)}
    </div>
    
    <div class="card">
      <h3>Tambah Soal PG</h3>
      <form method="POST" action="/admin/quizzes/${quizId}/questions">
        <label>Pertanyaan</label>
        <textarea name="prompt" required rows="2"></textarea>
        
        <label>Opsi A</label>
        <input type="text" name="opt_0" required>
        <label><input type="checkbox" name="correct_0" value="0"> Jawaban benar</label>
        
        <label>Opsi B</label>
        <input type="text" name="opt_1" required>
        <label><input type="checkbox" name="correct_1" value="1"> Jawaban benar</label>
        
        <label>Opsi C</label>
        <input type="text" name="opt_2">
        <label><input type="checkbox" name="correct_2" value="2"> Jawaban benar</label>
        
        <label>Opsi D</label>
        <input type="text" name="opt_3">
        <label><input type="checkbox" name="correct_3" value="3"> Jawaban benar</label>
        
        <label>Poin</label>
        <input type="number" name="points" value="1" min="1">
        
        <div class="actions">
          <button type="submit" class="btn btn-primary">Tambah Soal</button>
        </div>
      </form>
    </div>
    
    <div class="card">
      <form method="POST" action="/admin/quizzes/${quizId}/publish">
        <button type="submit" class="btn btn-${quiz.published ? 'warning' : 'success'}">${quiz.published ? 'Unpublish' : 'Publish'} Kuis</button>
      </form>
    </div>
  </main>
</div></body></html>`);
});

// ═══════════════════════════════════════════════
// Admin: Add question
// ═══════════════════════════════════════════════

quizRoutes.post("/admin/quizzes/:quizId/questions", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  
  const { quizId } = c.req.param();
  const form = await c.req.parseBody();
  
  const options: string[] = [];
  const correctKeys: string[] = [];
  
  for (let i = 0; i < 4; i++) {
    const opt = form[`opt_${i}`];
    if (opt) options.push(opt as string);
    if (form[`correct_${i}`]) correctKeys.push(String(i));
  }
  
  if (options.length < 2) return c.html(html`<p>Minimal 2 opsi.</p>`, 400);
  if (correctKeys.length === 0) return c.html(html`<p>Pilih minimal 1 jawaban benar.</p>`, 400);
  
  const qId = `qq-${Date.now()}`;
  const quiz = await c.env.DB.prepare("SELECT lesson_id FROM quizzes WHERE id = ?").bind(quizId).first();
  
  await c.env.DB.prepare(
    "INSERT INTO quiz_questions (id, quiz_id, prompt, options, correct_keys, points, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    qId,
    quizId,
    form.prompt,
    JSON.stringify(options),
    JSON.stringify(correctKeys),
    parseInt(form.points as string) || 1,
    Date.now()
  ).run();
  
  return c.redirect(`/admin/courses/${courseSlug}/lessons/${lessonSlug}/quizzes/${quizId}/edit`);
});

// ═══════════════════════════════════════════════
// Admin: Delete question
// ═══════════════════════════════════════════════

quizRoutes.post("/admin/quizzes/:quizId/questions/:qId/delete", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  
  await c.env.DB.prepare("DELETE FROM quiz_questions WHERE id = ?").bind(c.req.param("qId")).run();
  return c.redirect(c.req.url.replace(`/questions/${c.req.param("qId")}/delete`, ""));
});

// ═══════════════════════════════════════════════
// Admin: Publish/Unpublish
// ═══════════════════════════════════════════════

quizRoutes.post("/admin/quizzes/:quizId/publish", async (c) => {
  const user = await getUser(c);
  if (!user || user.role === "siswa") return c.json({ error: "forbidden" }, 403);
  
  const { quizId } = c.req.param();
  const quiz = await c.env.DB.prepare("SELECT published FROM quizzes WHERE id = ?").bind(quizId).first();
  
  await c.env.DB.prepare("UPDATE quizzes SET published = ? WHERE id = ?").bind(quiz?.published ? 0 : 1, quizId).run();
  return c.redirect(c.req.url.replace("/publish", "/edit"));
});

// ═══════════════════════════════════════════════
// Siswa: View quiz
// ═══════════════════════════════════════════════

quizRoutes.get("/c/:courseSlug/lessons/:lessonSlug/quiz/:quizId", async (c) => {
  const user = await getUser(c);
  if (!user) return c.redirect("/login");
  
  const { courseSlug, lessonSlug, quizId } = c.req.param();
  
  const quiz = await c.env.DB.prepare("SELECT * FROM quizzes WHERE id = ? AND published = 1").bind(quizId).first();
  if (!quiz) return c.html(html`<p>Kuis tidak ditemukan atau belum dipublish.</p>`, 404);
  
  const questions = await c.env.DB.prepare(
    "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position"
  ).bind(quizId).all();
  
  const questionHtml = questions.results.map((q: any, qi: number) => 
    `<div class="card">
      <p><strong>Soal ${qi + 1}:</strong> ${q.prompt}</p>
      ${(JSON.parse(q.options) as string[]).map((opt: string, oi: number) => 
        `<label style="display:block;margin:0.25rem 0">
          <input type="radio" name="q_${q.id}" value="${oi}" required>
          ${opt}
        </label>`
      ).join("")}
    </div>`
  ).join("");

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Kuis: ${quiz.title}</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>${quiz.title}</h1><a href="/c/${courseSlug}/lessons/${lessonSlug}" class="btn btn-sm">Kembali ke Lesson</a></header>
  <main>
    <div class="card">
      <p>Pass Score: ${quiz.pass_score}%</p>
      <p>Jumlah Soal: ${questions.results.length}</p>
      ${quiz.time_limit_s > 0 ? html`<p>Waktu: ${Math.floor(quiz.time_limit_s / 60)} menit</p>` : ""}
    </div>
    
    <form method="POST" action="/api/quizzes/${quizId}/submit">
      ${raw(questionHtml)}
      
      <div class="actions">
        <button type="submit" class="btn btn-primary">Submit Jawaban</button>
      </div>
    </form>
  </main>
</div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Submit quiz & score
// ═══════════════════════════════════════════════

quizRoutes.post("/api/quizzes/:quizId/submit", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  
  const { quizId } = c.req.param();
  const form = await c.req.parseBody();
  
  const quiz = await c.env.DB.prepare("SELECT * FROM quizzes WHERE id = ? AND published = 1").bind(quizId).first();
  if (!quiz) return c.json({ error: "Quiz not found" }, 404);
  
  const questions = await c.env.DB.prepare(
    "SELECT * FROM quiz_questions WHERE quiz_id = ?"
  ).bind(quizId).all();
  
  let totalScore = 0;
  let totalPoints = 0;
  const answers: Record<string, number> = {};
  
  for (const q of questions.results) {
    const correctKeys = JSON.parse(q.correct_keys) as string[];
    const userAnswer = form[`q_${q.id}`];
    answers[q.id] = userAnswer ? parseInt(userAnswer as string) : -1;
    totalPoints += q.points;
    
    if (correctKeys.includes(userAnswer as string)) {
      totalScore += q.points;
    }
  }
  
  const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
  const passed = percentage >= quiz.pass_score;
  
  const attemptId = `qa-${Date.now()}`;
  await c.env.DB.prepare(
    "INSERT INTO quiz_attempts (id, quiz_id, user_id, started_at, submitted_at, score, passed, answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    attemptId,
    quizId,
    user.id,
    Date.now(),
    Date.now(),
    percentage,
    passed ? 1 : 0,
    JSON.stringify(answers)
  ).run();
  
  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Hasil Kuis</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>Hasil Kuis: ${quiz.title}</h1></header>
  <main>
    <div class="card">
      <h2 class="${passed ? 'text-success' : 'text-danger'}">${passed ? 'LULUS' : 'TIDAK LULUS'}</h2>
      <p>Skor: <strong>${percentage}%</strong> (${totalScore}/${totalPoints} poin)</p>
      <p>Pass Score: ${quiz.pass_score}%</p>
    </div>
    <a href="/dashboard" class="btn btn-primary">Kembali ke Dashboard</a>
  </main>
</div></body></html>`);
});
