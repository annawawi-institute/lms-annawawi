-- LMS Annawawi — M3: Courses, Lessons, Enrollment, Progress, Quizzes
-- Run: bunx wrangler d1 execute lms-annawawi-db --remote --file=./drizzle/0001_courses.sql

-- ═══════════════════════════════════════════════
-- Courses & Lessons
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_key TEXT,
  join_code TEXT,
  status TEXT DEFAULT 'draft',  -- draft | published | archived
  created_by TEXT REFERENCES user(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS lesson_blocks (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type TEXT NOT NULL,       -- markdown | embed | file | callout
  provider TEXT,            -- tally | google_form | youtube | r2_pdf | null
  url TEXT,
  meta TEXT,                -- JSON
  position INTEGER NOT NULL DEFAULT 0
);

-- ═══════════════════════════════════════════════
-- Rombel (hybrid enrollment)
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS class_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tahun_ajaran TEXT
);

CREATE TABLE IF NOT EXISTS class_group_members (
  group_id TEXT REFERENCES class_groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS class_group_courses (
  group_id TEXT REFERENCES class_groups(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, course_id)
);

-- ═══════════════════════════════════════════════
-- Enrollment (single table)
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS enrollments (
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  source TEXT NOT NULL,     -- rombel | manual | join_code
  enrolled_by TEXT REFERENCES user(id),
  enrolled_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (course_id, user_id)
);

-- ═══════════════════════════════════════════════
-- Progress tracking
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'viewed',  -- viewed | done
  marked_by TEXT REFERENCES user(id),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (user_id, lesson_id)
);

-- ═══════════════════════════════════════════════
-- Quizzes
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  time_limit_s INTEGER,
  pass_score INTEGER DEFAULT 70,
  published INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,         -- JSON array
  correct_keys TEXT NOT NULL,    -- JSON array
  points INTEGER DEFAULT 1,
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  started_at INTEGER,
  submitted_at INTEGER,
  score INTEGER,
  passed INTEGER DEFAULT 0,
  answers TEXT                  -- JSON
);

-- ═══════════════════════════════════════════════
-- WA mode wa.me
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wa_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT,               -- JSON array
  created_by TEXT REFERENCES user(id),
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS wa_link_log (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES wa_templates(id),
  sender_id TEXT REFERENCES user(id),
  recipient_user_id TEXT REFERENCES user(id),
  link TEXT NOT NULL,
  opened_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ═══════════════════════════════════════════════
-- Settings
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ═══════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_blocks_lesson ON lesson_blocks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
