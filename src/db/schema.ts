// src/db/schema.ts — Drizzle schema for LMS Annawawi
// Based on locked plan 2026-08-29: hybrid rombel + manual enrollment

import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// ═══════════════════════════════════════════════
// Better Auth managed tables (do not edit manually)
// ═══════════════════════════════════════════════

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  // LMS custom columns
  role: text("role").notNull().default("siswa"),
  noWa: text("no_wa"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// ═══════════════════════════════════════════════
// Rombel (hybrid enrollment)
// ═══════════════════════════════════════════════

export const classGroups = sqliteTable("class_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tahunAjaran: text("tahun_ajaran"),
});

export const classGroupMembers = sqliteTable(
  "class_group_members",
  {
    groupId: text("group_id").references(() => classGroups.id),
    userId: text("user_id").references(() => user.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.userId] }),
  })
);

export const classGroupCourses = sqliteTable(
  "class_group_courses",
  {
    groupId: text("group_id").references(() => classGroups.id),
    courseId: text("course_id").references(() => courses.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.courseId] }),
  })
);

// ═══════════════════════════════════════════════
// Courses & lessons
// ═══════════════════════════════════════════════

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  coverKey: text("cover_key"),
  joinCode: text("join_code"),
  status: text("status").default("draft"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const lessons = sqliteTable("lessons", {
  id: text("id").primaryKey(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  status: text("status").default("draft"),
});

export const lessonBlocks = sqliteTable("lesson_blocks", {
  id: text("id").primaryKey(),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id),
  type: text("type").notNull(),
  provider: text("provider"),
  url: text("url"),
  meta: text("meta", { mode: "json" }),
  position: integer("position").notNull().default(0),
});

// ═══════════════════════════════════════════════
// Enrollment (single table: rombel + manual)
// ═══════════════════════════════════════════════

export const enrollments = sqliteTable(
  "enrollments",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    source: text("source").notNull(),
    enrolledBy: text("enrolled_by").references(() => user.id),
    enrolledAt: integer("enrolled_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.courseId, t.userId] }),
  })
);

// ═══════════════════════════════════════════════
// Progress tracking
// ═══════════════════════════════════════════════

export const progress = sqliteTable(
  "progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id),
    status: text("status").default("viewed"),
    markedBy: text("marked_by"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.lessonId] }),
  })
);

// ═══════════════════════════════════════════════
// Quizzes
// ═══════════════════════════════════════════════

export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  lessonId: text("lesson_id").references(() => lessons.id),
  title: text("title").notNull(),
  timeLimitS: integer("time_limit_s"),
  passScore: integer("pass_score").default(70),
  published: integer("published", { mode: "boolean" }).default(false),
});

export const quizQuestions = sqliteTable("quiz_questions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id),
  prompt: text("prompt").notNull(),
  options: text("options", { mode: "json" }).notNull(),
  correctKeys: text("correct_keys", { mode: "json" }).notNull(),
  points: integer("points").default(1),
  position: integer("position").default(0),
});

export const quizAttempts = sqliteTable("quiz_attempts", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
  score: integer("score"),
  passed: integer("passed", { mode: "boolean" }),
  answers: text("answers", { mode: "json" }),
});

// ═══════════════════════════════════════════════
// Tally webhook
// ═══════════════════════════════════════════════

export const tallySubmissions = sqliteTable("tally_submissions", {
  submissionId: text("submission_id").primaryKey(),
  formId: text("form_id"),
  eventId: text("event_id"),
  payload: text("payload", { mode: "json" }),
  processed: integer("processed", { mode: "boolean" }).default(false),
  receivedAt: integer("received_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const tallyFieldMap = sqliteTable(
  "tally_field_map",
  {
    formId: text("form_id").notNull(),
    fieldKey: text("field_key").notNull(),
    canonical: text("canonical").notNull(),
    valueType: text("value_type").notNull().default("text"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.formId, t.fieldKey] }),
  })
);

// ═══════════════════════════════════════════════
// WA mode wa.me
// ═══════════════════════════════════════════════

export const waTemplates = sqliteTable("wa_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  body: text("body").notNull(),
  variables: text("variables", { mode: "json" }),
  createdBy: text("created_by").references(() => user.id),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const waLinkLog = sqliteTable("wa_link_log", {
  id: text("id").primaryKey(),
  templateId: text("template_id").references(() => waTemplates.id),
  senderId: text("sender_id").references(() => user.id),
  recipientUserId: text("recipient_user_id").references(() => user.id),
  link: text("link").notNull(),
  openedAt: integer("opened_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// ═══════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});
