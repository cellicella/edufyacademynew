# Edufy Academy - Supabase Backend & Razorpay Integration Setup Guide

This guide provides end-to-end instructions for deploying, configuring, and verifying the production-ready Supabase PostgreSQL backend and server-side Razorpay payment integration for **Edufy Academy**.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          Edufy React Frontend          │
                      │  (Client-side, Vite, Tailwind, Motion) │
                      └─────────────┬────────────────┬─────────┘
                                    │                │
            Public Anon Key         │                │  Bearer JWT
         (Direct RLS Queries)       │                │  (Authenticated APIs)
                                    ▼                ▼
                 ┌──────────────────────┐    ┌─────────────────────────────────┐
                 │    Supabase Cloud    │    │      Express Server (server.ts) │
                 │ ──────────────────── │    │ ─────────────────────────────── │
                 │ • Auth (Users & JWT) │    │ • Razorpay Order Creation       │
                 │ • PostgreSQL Schema  │◄───┤ • HMAC SHA-256 Verification     │
                 │ • Row Level Security │    │ • Certificate Issuance & Claim  │
                 │ • Storage Buckets    │    │ • Protected Storage Signed URLs │
                 └──────────────────────┘    └────────────────┬────────────────┘
                                                              │
                                                              ▼
                                                 ┌─────────────────────────────┐
                                                 │   Razorpay Payment Gateway  │
                                                 │ • Orders API                │
                                                 │ • Webhook Events            │
                                                 └─────────────────────────────┘
```

### Security Principles Enforced
1. **Zero Client-Side Secret Leakage**: `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` reside strictly on the Node.js server. Vite never bundles them.
2. **Cryptographic Payment Validation**: Course access is never granted on client claims. The client receives a signature from Razorpay checkout and sends it to `/api/payments/verify-payment`. The server verifies `HMAC-SHA256(order_id + "|" + payment_id, secret)` and transactionally writes to `enrollments`.
3. **Database RLS**: Every table (`courses`, `lessons`, `payments`, `enrollments`, `lesson_progress`, `quizzes`, `certificates`) has Row Level Security active.

---

## Stage 1: Supabase Dashboard Configuration

### 1. Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL**, **anon key**, and **service_role key** from **Project Settings > API**.

### 2. Run Database Migrations
1. In the Supabase Dashboard, open the **SQL Editor**.
2. Open the file `supabase/migrations/20261024000001_edufy_schema.sql` from this codebase.
3. Paste the contents into the SQL Editor and click **Run**.
   - This provisions all 13 normalized tables, triggers, indexes, and RLS policies.
4. Next, open `supabase/seed.sql` and run it in the SQL Editor.
   - This seeds the real courses, curriculum modules, lessons, quizzes, and sample instructor profiles.

### 3. Verify Row Level Security (RLS)
Navigate to **Authentication > Policies** or **Table Editor**:
- Verify that every table displays **RLS Enabled**.
- `lessons`: Free preview lessons are readable by anyone; non-preview lessons require active enrollment via `is_enrolled(course_id)`.
- `enrollments`: Students can only read their own records (`user_id = auth.uid()`).
- `payments`: Students can only read their own records; writes are service-role only.

### 4. Configure Supabase Storage
1. Navigate to **Storage** in your Supabase dashboard.
2. Verify or create the following 3 buckets:
   - `course-thumbnails` (Public: Yes) - for masterclass banners and cards.
   - `certificates` (Public: Yes) - for generated credential badges.
   - `course-materials` (Public: No / Private) - for exclusive downloadable PDFs and source code.
3. RLS policies are pre-written in `001_edufy_schema.sql` allowing only actively enrolled students to request access.

### 5. Configure Authentication & Email Templates
1. Navigate to **Authentication > Providers > Email**:
   - Ensure **Email provider** is Enabled.
   - (Optional for development) Toggle "Confirm email" according to your preference.
2. Under **Authentication > URL Configuration**:
   - Set **Site URL** to `http://localhost:3000` (or your production domain).
   - Add Redirect URL: `http://localhost:3000/reset-password`.

---

## Stage 2: Razorpay Payment Gateway Setup

### 1. Create Razorpay Account & Generate Keys
1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Switch to **Test Mode** (or Live Mode for production).
3. Go to **Settings > API Keys** and click **Generate Key**.
4. Copy the **Key ID** (`rzp_test_...` or `rzp_live_...`) and **Key Secret**.

### 2. Configure Webhooks (Optional for async fulfillment)
1. In Razorpay Dashboard, go to **Settings > Webhooks > Add New Webhook**.
2. Webhook URL: `https://your-domain.com/api/payments/webhook`.
3. Secret: Enter a strong random secret (set this as `RAZORPAY_WEBHOOK_SECRET`).
4. Active Events:
   - `payment.captured`
   - `order.paid`
   - `payment.failed`

---

## Stage 3: Environment Variables Setup

Create a `.env` file in the project root based on `.env.example`:

```bash
# Fullstack Server
PORT=3000

# Supabase (Public - Client)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"

# Supabase (Privileged - Server Only)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-secret-key"

# Razorpay (Public - Client & Server)
RAZORPAY_KEY_ID="rzp_test_yourKeyId"

# Razorpay (Privileged - Server Only)
RAZORPAY_KEY_SECRET="your_razorpay_secret_key"
RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"
```

---

## Stage 4: Starting the Fullstack Server

Run the development server:
```bash
npm run dev
```
This boots the unified Express fullstack server on port 3000 with Vite middleware.

---

## Stage 5: Verification & Testing Workflow

### 1. Test Health & Status Endpoint
Check your server configuration:
```bash
curl http://localhost:3000/api/health
```
Response:
```json
{
  "status": "ok",
  "service": "Edufy Academy Backend API",
  "supabase": { "configured": true, "hasServiceRole": true },
  "razorpay": { "configured": true, "keyId": "rzp_test..." }
}
```

### 2. Test Supabase Authentication
1. Navigate to `http://localhost:3000/register`.
2. Register a new student account with email and password.
3. Check the Supabase **auth.users** and **public.profiles** tables to verify automatic profile creation via trigger.
4. Sign out and test `http://localhost:3000/login`.
5. Test `http://localhost:3000/forgot-password` to test email reset flow.

### 3. Test Server-Side Razorpay Payment Order & Verification
1. Navigate to `http://localhost:3000/courses/course-1`.
2. Click **Enroll Now**.
3. Inspect network traffic:
   - Notice `POST /api/payments/create-order` creates the order on the backend.
   - The Razorpay checkout dialog opens.
   - Upon completion, `POST /api/payments/verify-payment` validates the cryptographic signature.
   - Only upon 200 OK verification does the client navigate to `/learn/course-1`.
4. Inspect the `payments` and `enrollments` tables in Supabase to confirm the record was inserted.

### 4. Test Course Progress & Certificate Issuance
1. Open the learning player at `http://localhost:3000/learn/course-1`.
2. Complete lessons; observe real-time row creation in `public.lesson_progress`.
3. Submit a module quiz; verify evaluation and recording in `public.quiz_attempts`.
4. Once all lessons are marked complete, click "Claim Certificate" to test `POST /api/certificates/claim`.
5. Verify the certificate using the public code at `http://localhost:3000/verify-certificate`.
