#!/bin/bash
# scripts/setup-local-db.sh — Setup database lokal untuk development
set -e

cd "$(dirname "$0")/.."

echo "Setting up local D1 database..."

echo "  → Creating tables (0000: Better Auth)..."
bunx wrangler d1 execute lms-annawawi-db --local --file=./drizzle/0000_better_auth.sql

echo "  → Creating tables (0001: Courses/Rombel/Enrollments)..."
bunx wrangler d1 execute lms-annawawi-db --local --file=./drizzle/0001_courses.sql

echo "  → Seeding data..."
bunx wrangler d1 execute lms-annawawi-db --local --file=./drizzle/0002_seed.sql

echo "  ✓ Local database ready"
echo ""
echo "Starting dev server: bunx wrangler dev --port 8787 --local"
