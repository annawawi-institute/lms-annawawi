// src/lib/validations.ts — Zod schemas for form input validation
import { z } from "zod";

export const courseSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi").max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung"),
  description: z.string().max(2000).optional().default(""),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export const lessonSchema = z.object({
  title: z.string().min(1).max(200),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const blockSchema = z.object({
  block_id: z.string().optional(),
  type: z.enum(["markdown", "embed", "file", "callout"]),
  provider: z.enum(["youtube", "tally", "google_form", "r2_pdf"]).or(z.null()),
  url: z.string().max(1000).optional(),
});

export const rombelSchema = z.object({
  name: z.string().min(1).max(100),
  tahun_ajaran: z.string().max(20).optional(),
});

export const joinCodeSchema = z.object({
  join_code: z.string().min(3).max(30).regex(/^[A-Za-z0-9-]+$/, "Kode hanya boleh huruf, angka, dan tanda hubung"),
});

export function parseBody<T>(schema: z.ZodSchema<T>, body: Record<string, unknown>):
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(body);
  if (result.success) return { success: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    errors[issue.path.join(".")] = issue.message;
  }
  return { success: false, errors };
}
