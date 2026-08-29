// src/routes/users.ts — Admin user management (role assignment, list)
import { Hono } from "hono";
import { html } from "hono/html";
import { createAuth } from "../lib/auth";

export const userRoutes = new Hono<{ Bindings: Env }>();

async function getUser(c: any) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user ?? null;
}

// ═══════════════════════════════════════════════
// Admin: List all users + change role
// ═══════════════════════════════════════════════

userRoutes.get("/admin/users", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "admin") return c.redirect("/login");

  const users = await c.env.DB.prepare(
    "SELECT id, name, email, role, noWa FROM user ORDER BY name"
  ).all();

  const roles = ["admin", "guru", "siswa"];

  return c.html(html`<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>User — LMS Annawawi</title><link rel="stylesheet" href="/styles.css"></head>
<body><div class="container">
  <header><h1>Kelola User</h1><a href="/admin" class="btn btn-sm">Kembali</a></header>
  <main>
    <div class="card">
      <table>
        <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Aksi</th></tr></thead>
        <tbody>
          ${users.results.map((u: any) => html`<tr>
            <td>${u.name}</td><td>${u.email}</td>
            <td><span class="badge badge-${u.role === 'admin' ? 'success' : u.role === 'guru' ? 'info' : 'warning'}">${u.role}</span></td>
            <td>
              <form method="POST" action="/api/users/${u.id}/role" style="display:inline">
                <select name="role" onchange="this.form.submit()">
                  ${roles.map((r: string) => html`<option value="${r}" ${u.role === r ? "selected" : ""}>${r}</option>`)}
                </select>
              </form>
            </td>
          </tr>`)}
        </tbody>
      </table>
    </div>
  </main>
</div></body></html>`);
});

// ═══════════════════════════════════════════════
// API: Change user role
// ═══════════════════════════════════════════════

userRoutes.post("/api/users/:id/role", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const id = c.req.param("id");
  const form = await c.req.parseBody();
  const role = form.role;
  if (!["admin", "guru", "siswa"].includes(role as string)) {
    return c.json({ error: "Invalid role" }, 400);
  }
  await c.env.DB.prepare("UPDATE user SET role = ? WHERE id = ?").bind(role, id).run();
  return c.redirect("/admin/users");
});
