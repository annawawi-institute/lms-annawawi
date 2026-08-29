-- Seed: Kursus "Dokumen AGE" + mata pelajaran "Pembukaan"
INSERT OR IGNORE INTO courses (id, title, slug, description, status, created_by, created_at, updated_at)
VALUES ('course-dokumen-age', 'Dokumen AGE', 'dokumen-age', 'Kursus Dokumen AGE — memahami dokumen-dokumen penting Annawawi Institute.', 'published', NULL, unixepoch() * 1000, unixepoch() * 1000);

INSERT OR IGNORE INTO lessons (id, course_id, title, position, status)
VALUES ('lesson-pembukaan', 'course-dokumen-age', 'Pembukaan', 0, 'published');

INSERT OR IGNORE INTO lesson_blocks (id, lesson_id, type, provider, url, position, meta)
VALUES 
  ('block-selamat', 'lesson-pembukaan', 'markdown', NULL, '## Selamat Datang di Dokumen AGE

Selamat datang di kursus **Dokumen AGE** — mata pelajaran **Pembukaan**.

Di sini Anda akan mempelajari dokumen-dokumen penting yang menjadi fondasi pembelajaran di Annawawi Institute.', 0, NULL),
  ('block-video', 'lesson-pembukaan', 'embed', 'youtube', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 1, NULL),
  ('block-form', 'lesson-pembukaan', 'embed', 'google_form', 'https://docs.google.com/forms/d/e/1FAIpQLSf/viewform?embedded=true', 2, NULL);
