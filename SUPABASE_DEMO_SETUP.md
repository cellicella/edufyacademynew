# Edufy Academy — Supabase demo environment

Project: `https://tyqdyfecdvclwsvcahod.supabase.co`

## Current state (verified 7 Nov 2026 via the Supabase connector)

- All 13 tables exist with RLS enabled; both migrations are applied.
- Trigger functions are no longer callable via `/rest/v1/rpc/*`.
- 10 demo courses, 32 sections and 96 lessons are loaded (`supabase/demo_courses_seed.sql`). Anonymous visitors can see all courses and sections, but only the 10 free-preview lessons.
- Demo **accounts are not created yet**. Run `scripts/seed-demo.ts` (step 4). It also assigns each course to its instructor.
- Email confirmation is **on**, so new self-registered users must click the email link before logging in. Seeded demo users are auto-confirmed.

## 1. Files

| File | Purpose | Commit? |
|---|---|---|
| `.env.local` | Public frontend values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) | No (ignored) |
| `.env` | Server-only secrets: `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PASSWORD`, Razorpay keys | No (ignored) |
| `supabase/migrations/20261024000001_edufy_schema.sql` | Tables, RLS, buckets | Yes |
| `supabase/migrations/20261107000001_edufy_security_hardening.sql` | Admin-escalation fixes, demo flags, storage | Yes |
| `scripts/seed-demo.ts` | Creates 9 demo accounts + 10 courses via the Auth Admin API (idempotent) | Yes |
| `scripts/verify-demo.ts` | Logs in as every account with the public key and checks roles/RLS | Yes |

Do **not** run the older `supabase/fix_auth_trigger.sql`, `seed.sql`, `demo_courses.sql` or `setup_admin.sql`. They trust the role sent at sign-up (which lets anyone become admin) or insert legacy demo data.

## 2. Create the schema (Supabase dashboard → SQL Editor)

1. Paste and run `supabase/migrations/20261024000001_edufy_schema.sql`.
2. Paste and run `supabase/migrations/20261107000001_edufy_security_hardening.sql`.

## 3. Add server secrets to `.env` (project root)

```
SUPABASE_URL=https://tyqdyfecdvclwsvcahod.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Project Settings → API Keys → secret / service_role key>
DEMO_PASSWORD=<at least 6 characters>
```

Supabase Auth requires passwords of at least 6 characters, so `123` cannot be used.

## 4. Seed and verify

```
npm install
npx tsx scripts/seed-demo.ts
npx tsx scripts/verify-demo.ts
npm run dev
```

## Demo accounts (password = `DEMO_PASSWORD`)

| Role | Email | Name |
|---|---|---|
| Student | student1@edufyacademy.com | Aarav Sharma |
| Student | student2@edufyacademy.com | Priya Nair |
| Student | student3@edufyacademy.com | Rohan Mehta |
| Student | student4@edufyacademy.com | Ananya Iyer |
| Student | student5@edufyacademy.com | Karthik Reddy |
| Instructor | instructor1@edufyacademy.com | Vikram Rao |
| Instructor | instructor2@edufyacademy.com | Dr. Meera Krishnan |
| Instructor | instructor3@edufyacademy.com | Sneha Kapoor |
| Admin | admin@edufyacademy.com | Edufy Administrator |

## Demo courses (all published, `is_demo = true`)

| Course | Price | Instructor | Category |
|---|---|---|---|
| Complete Web Development | ₹999 | Vikram Rao | Web Development |
| Full Stack MERN Development | ₹1,499 | Vikram Rao | Web Development |
| Artificial Intelligence Fundamentals | ₹1,299 | Dr. Meera Krishnan | Artificial Intelligence |
| Python Programming Masterclass | ₹799 | Vikram Rao | Artificial Intelligence |
| Digital Marketing Masterclass | ₹999 | Sneha Kapoor | Business & Leadership |
| Ethical Hacking Masterclass | ₹1,499 | Dr. Meera Krishnan | Cybersecurity |
| UI/UX Design with Figma | ₹899 | Sneha Kapoor | UI/UX Design |
| Data Analytics with Excel | ₹1,199 | Dr. Meera Krishnan | Artificial Intelligence |
| WordPress Website Development | ₹699 | Vikram Rao | Web Development |
| Freelancing and Online Business | ₹599 | Sneha Kapoor | Business & Leadership |

Each course has 3–4 sections of 3 lessons. Lessons are article-type placeholders marked "[Demo lesson content]", and the first lesson of each course is a free preview. Thumbnails are Unsplash images. No payments, enrollments, reviews or ratings are created, so courses show as "New course".

## Security notes

- The service role key is read only by `server.ts` and `scripts/seed-demo.ts` from `.env`. The seed script refuses to run if the key appears in a `VITE_` variable.
- Sign-up can request `student` or `instructor`, never `admin`. A database trigger blocks every client-side role change. Only the service role, the SQL editor or an existing admin can change roles.
- The open "Service role can manage payments" policy is removed.
- The login page's demo buttons now only pre-fill an email address. The old hardcoded password and automatic account creation were removed.
- Still open from the code review: profiles (including email) are publicly readable; certificates don't require full completion; the Razorpay webhook and verify-payment checks need tightening.
