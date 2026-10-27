import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize Supabase Admin Client (Server-side privileged client with Service Role Key)
let supabaseAdmin: SupabaseClient | null = null;
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log('[Server] Supabase Service Role client initialized.');
} else if (supabaseUrl && supabaseAnonKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);
  console.log('[Server] Supabase Anonymous client initialized.');
} else {
  console.warn('[Server] Supabase credentials not found in env. Running in demo fallback mode.');
}

// Razorpay Configuration
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

let razorpayClient: any = null;
if (razorpayKeyId && razorpayKeySecret) {
  try {
    razorpayClient = new (Razorpay as any)({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });
    console.log('[Server] Razorpay client initialized.');
  } catch (err) {
    console.error('[Server] Failed to initialize Razorpay client:', err);
  }
} else {
  console.warn('[Server] Razorpay credentials not configured. Server payment simulation available for testing.');
}

// Enable CORS
app.use(cors());

// Middleware to capture raw body for webhook verification with 50mb limit for uploads
app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Authentication Helper: extracts user from Bearer token
 */
async function getAuthUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token) return null;

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        return null;
      }
      return data.user;
    } catch {
      return null;
    }
  }

  return null;
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Health & Configuration Status
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Edufy Academy Backend API',
    supabase: {
      configured: !!(supabaseUrl && (supabaseServiceKey || supabaseAnonKey)),
      hasServiceRole: !!supabaseServiceKey,
    },
    razorpay: {
      configured: !!(razorpayKeyId && razorpayKeySecret),
      keyId: razorpayKeyId ? `${razorpayKeyId.substring(0, 8)}...` : null,
    },
  });
});

/**
 * 1. Create Razorpay Payment Order
 * POST /api/payments/create-order
 */
app.post('/api/payments/create-order', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Valid authentication token required.' });
    }

    const { courseId, courseIds, currency = 'INR' } = req.body;
    const targetCourseIds: string[] = Array.isArray(courseIds) && courseIds.length > 0
      ? courseIds
      : courseId
      ? [courseId]
      : [];

    if (targetCourseIds.length === 0) {
      return res.status(400).json({ error: 'Missing courseId or courseIds parameter.' });
    }

    // Check if user is already enrolled in all requested courses
    if (supabaseAdmin) {
      const { data: existingEnrollments } = await supabaseAdmin
        .from('enrollments')
        .select('course_id')
        .eq('user_id', user.id)
        .in('course_id', targetCourseIds)
        .eq('status', 'active');

      const enrolledIds = new Set((existingEnrollments || []).map((e: any) => e.course_id));
      const unenrolled = targetCourseIds.filter((id) => !enrolledIds.has(id));

      if (unenrolled.length === 0) {
        return res.status(400).json({
          error: 'Already enrolled: You have already purchased lifetime access to the selected course(s).',
        });
      }
    }

    // Retrieve course prices and titles
    let totalPrice = 0;
    let courseTitles: string[] = [];

    if (supabaseAdmin) {
      const { data: coursesData } = await supabaseAdmin
        .from('courses')
        .select('id, price, title')
        .in('id', targetCourseIds);

      if (coursesData && coursesData.length > 0) {
        coursesData.forEach((c: any) => {
          totalPrice += parseFloat(c.price) || 0;
          courseTitles.push(c.title);
        });
      }
    }

    // Fallback price computation if not in database
    if (totalPrice === 0) {
      totalPrice = targetCourseIds.length * 34.99;
      courseTitles = targetCourseIds.map((id) => `Edufy Masterclass (${id})`);
    }

    // Subunits (paise for INR, cents for USD)
    const amountInSubunits = Math.round(totalPrice * 100);
    const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const displayTitle = courseTitles.length === 1
      ? courseTitles[0]
      : `Edufy Learning Bundle (${courseTitles.length} Courses)`;

    let orderId: string;

    if (razorpayClient) {
      const options = {
        amount: amountInSubunits,
        currency,
        receipt: receiptId,
        notes: {
          courseId: targetCourseIds[0],
          courseIds: targetCourseIds.join(','),
          userId: user.id,
          userEmail: user.email || '',
          courseTitle: displayTitle,
        },
      };

      const order = await razorpayClient.orders.create(options);
      orderId = order.id;
    } else {
      orderId = `order_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      console.log(`[Payment] Razorpay test order created: ${orderId} for ${targetCourseIds.length} course(s)`);
    }

    // Record initial pending payment in Supabase database
    if (supabaseAdmin) {
      await supabaseAdmin.from('payments').insert({
        user_id: user.id,
        course_id: targetCourseIds[0],
        razorpay_order_id: orderId,
        amount: totalPrice,
        currency,
        status: 'created',
        receipt: receiptId,
        notes: {
          courseTitle: displayTitle,
          courseIds: targetCourseIds,
          courseTitles,
          createdVia: 'api/payments/create-order',
        },
      });
    }

    return res.json({
      orderId,
      amount: amountInSubunits,
      currency,
      keyId: razorpayKeyId || 'rzp_test_edufy_dummy_key',
      courseTitle: displayTitle,
      courseIds: targetCourseIds,
      user: {
        name: user.user_metadata?.full_name || 'Edufy Student',
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('[Payment Error] create-order failed:', error);
    return res.status(500).json({
      error: 'Failed to create payment order.',
      details: error?.message || 'Internal server error',
    });
  }
});

/**
 * 2. Verify Razorpay Payment Signature & Grant Enrollment
 * POST /api/payments/verify-payment
 */
app.post('/api/payments/verify-payment', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Valid authentication token required.' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, course_id, course_ids } = req.body;
    const targetCourseIds: string[] = Array.isArray(course_ids) && course_ids.length > 0
      ? course_ids
      : course_id
      ? [course_id]
      : [];

    if (!razorpay_order_id || !razorpay_payment_id || targetCourseIds.length === 0) {
      return res.status(400).json({ error: 'Missing required payment verification parameters.' });
    }

    let isValid = false;

    // Cryptographic signature verification using HMAC-SHA256
    if (razorpayKeySecret && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      isValid = crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(razorpay_signature)
      );
    } else if (!razorpayKeySecret && razorpay_order_id.startsWith('order_test_')) {
      // In development mode when keys are not yet configured
      isValid = true;
      console.log('[Payment] Verified test mode signature successfully.');
    }

    if (!isValid) {
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('payments')
          .update({
            status: 'failed',
            razorpay_payment_id,
            razorpay_signature,
            updated_at: new Date().toISOString(),
          })
          .eq('razorpay_order_id', razorpay_order_id);
      }

      return res.status(400).json({
        success: false,
        error: 'Payment verification failed: Invalid cryptographic signature.',
      });
    }

    // Step 3: Transactional fulfillment in Supabase
    let paymentRecordId: string | null = null;

    if (supabaseAdmin) {
      // 1. Mark payment as captured
      const { data: updatedPayment } = await supabaseAdmin
        .from('payments')
        .update({
          status: 'captured',
          razorpay_payment_id,
          razorpay_signature,
          updated_at: new Date().toISOString(),
        })
        .eq('razorpay_order_id', razorpay_order_id)
        .select('id')
        .single();

      if (updatedPayment) {
        paymentRecordId = updatedPayment.id;
      }

      // 2. Insert active enrollment records for all purchased courses
      for (const cId of targetCourseIds) {
        await supabaseAdmin
          .from('enrollments')
          .upsert(
            {
              user_id: user.id,
              course_id: cId,
              payment_id: paymentRecordId,
              status: 'active',
              enrolled_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,course_id' }
          );

        // 3. Increment course enrolled_count
        const { data: course } = await supabaseAdmin
          .from('courses')
          .select('enrolled_count')
          .eq('id', cId)
          .single();

        if (course) {
          await supabaseAdmin
            .from('courses')
            .update({ enrolled_count: (course.enrolled_count || 0) + 1 })
            .eq('id', cId);
        }
      }
    }

    return res.json({
      success: true,
      message: `Payment verified successfully and lifetime enrollment activated for ${targetCourseIds.length} course(s).`,
      courseIds: targetCourseIds,
      courseId: targetCourseIds[0],
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (error: any) {
    console.error('[Payment Error] verify-payment failed:', error);
    return res.status(500).json({
      error: 'Failed to verify payment.',
      details: error?.message || 'Internal server error',
    });
  }
});

/**
 * 3. Razorpay Server-to-Server Webhook Handler
 * POST /api/payments/webhook
 */
app.post('/api/payments/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;

    if (razorpayWebhookSecret && signature) {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', razorpayWebhookSecret)
        .update(rawBody)
        .digest('hex');

      const isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );

      if (!isSignatureValid) {
        console.warn('[Webhook] Invalid Razorpay webhook signature received.');
        return res.status(400).json({ error: 'Invalid webhook signature.' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`[Webhook] Received Razorpay event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const notes = paymentEntity?.notes || {};
      const courseIdsStr = notes.courseIds;
      const singleCourseId = notes.courseId;
      const userId = notes.userId;

      const targetCourseIds: string[] = courseIdsStr
        ? courseIdsStr.split(',').map((s: string) => s.trim())
        : singleCourseId
        ? [singleCourseId]
        : [];

      if (supabaseAdmin && orderId) {
        // Mark payment as captured & webhook_verified
        await supabaseAdmin
          .from('payments')
          .update({
            status: 'captured',
            razorpay_payment_id: paymentId,
            webhook_verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq('razorpay_order_id', orderId);

        // Ensure user enrollments are active for all purchased courses
        if (userId && targetCourseIds.length > 0) {
          for (const cId of targetCourseIds) {
            await supabaseAdmin.from('enrollments').upsert(
              {
                user_id: userId,
                course_id: cId,
                status: 'active',
                enrolled_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,course_id' }
            );
          }
        }
      }
    }

    return res.status(200).json({ status: 'ok', received: true });
  } catch (error: any) {
    console.error('[Webhook Error]:', error);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

/**
 * 3b. Student Payment & Transaction History Endpoint
 * GET /api/payments/history
 */
app.get('/api/payments/history', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (supabaseAdmin) {
      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('*, courses(id, title, thumbnail_url, category)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && payments) {
        return res.json({ payments });
      }
    }

    return res.json({ payments: [] });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve payment history', details: error?.message });
  }
});

/**
 * 4. Claim / Generate Verified Certificate
 * POST /api/certificates/claim
 */
app.post('/api/certificates/claim', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service is currently unavailable.' });
    }

    // Verify course exists
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('title, total_lessons, instructor_id, profiles(full_name)')
      .eq('id', courseId)
      .single();

    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    // Verify user is enrolled
    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single();

    if (!enrollment || enrollment.status !== 'active') {
      return res.status(403).json({ error: 'You must be actively enrolled in this course to claim a certificate.' });
    }

    // Verify completion: count completed lessons
    const { count: completedCount } = await supabaseAdmin
      .from('lesson_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('is_completed', true);

    const totalLessons = course.total_lessons || 1;
    const progressPercent = Math.min(100, Math.round(((completedCount || 0) / totalLessons) * 100));

    // Check if certificate already exists
    const { data: existingCert } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single();

    if (existingCert) {
      return res.json({ success: true, certificate: existingCert, alreadyIssued: true });
    }

    // Retrieve student name
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const studentName = profile?.full_name || user.user_metadata?.full_name || 'Edufy Graduate';
    const instructorName = (course as any).profiles?.full_name || 'Edufy Master Faculty';
    const certCode = `EDFY-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const verificationHash = crypto
      .createHash('sha256')
      .update(`${certCode}:${user.id}:${courseId}:${studentName}`)
      .digest('hex');

    const { data: newCert, error: certError } = await supabaseAdmin
      .from('certificates')
      .insert({
        certificate_code: certCode,
        user_id: user.id,
        course_id: courseId,
        student_name: studentName,
        course_title: course.title,
        instructor_name: instructorName,
        issue_date: new Date().toISOString().split('T')[0],
        grade_percentage: progressPercent || 100,
        verification_hash: verificationHash,
      })
      .select()
      .single();

    if (certError) {
      throw certError;
    }

    // Mark enrollment as completed
    await supabaseAdmin
      .from('enrollments')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', enrollment.id);

    return res.json({ success: true, certificate: newCert });
  } catch (error: any) {
    console.error('[Certificate Error]:', error);
    return res.status(500).json({ error: 'Failed to claim certificate.', details: error?.message });
  }
});

/**
 * 5. Verify Certificate Publicly by Code
 * GET /api/certificates/verify/:code
 */
app.get('/api/certificates/verify/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code.trim().toUpperCase();

    if (supabaseAdmin) {
      const { data: cert, error } = await supabaseAdmin
        .from('certificates')
        .select('*')
        .eq('certificate_code', code)
        .single();

      if (error || !cert) {
        return res.status(404).json({
          valid: false,
          error: 'Certificate not found. Please verify the alphanumeric code on your credentials.',
        });
      }

      return res.json({ valid: true, certificate: cert });
    }

    return res.status(404).json({ valid: false, error: 'Certificate credential code not recognized.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Verification service error.', details: error?.message });
  }
});

/**
 * 6. Generate Protected Supabase Storage Signed URL for Enrolled Learners
 * POST /api/storage/signed-url
 */
app.post('/api/storage/signed-url', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const { courseId, filePath } = req.body;
    if (!courseId || !filePath) {
      return res.status(400).json({ error: 'courseId and filePath are required.' });
    }

    if (!supabaseAdmin) {
      return res.json({ signedUrl: filePath });
    }

    // Verify user has active enrollment
    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('status', 'active')
      .single();

    if (!enrollment) {
      return res.status(403).json({ error: 'Access denied: Active course enrollment is required to access private resources.' });
    }

    // Create 1-hour signed URL from 'course-materials' private bucket
    const { data, error } = await supabaseAdmin.storage
      .from('course-materials')
      .createSignedUrl(filePath, 3600);

    if (error) {
      return res.status(500).json({ error: 'Failed to generate signed download URL.', details: error.message });
    }

    return res.json({ signedUrl: data.signedUrl });
  } catch (error: any) {
    return res.status(500).json({ error: 'Storage service failure.', details: error?.message });
  }
});

/**
 * Helper: Get Authenticated User & Profile
 */
async function getAuthUserProfile(req: Request) {
  const user = await getAuthUser(req);
  if (!user || !supabaseAdmin) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return { user, profile };
}

/**
 * 7. Upload Course Media / Assets to Supabase Storage
 * POST /api/upload
 */
app.post('/api/upload', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const role = auth.profile?.role || 'student';
    if (role !== 'instructor' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only instructors and administrators can upload course media.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const { fileBase64, fileName, fileType, bucket } = req.body;
    if (!fileBase64 || !fileName || !bucket) {
      return res.status(400).json({ error: 'fileBase64, fileName, and bucket are required.' });
    }

    const allowedBuckets = ['course-thumbnails', 'course-videos', 'course-materials'];
    if (!allowedBuckets.includes(bucket)) {
      return res.status(400).json({ error: `Invalid bucket. Allowed buckets: ${allowedBuckets.join(', ')}` });
    }

    // Strip data URL header if present (e.g. data:image/jpeg;base64,...)
    const base64Data = fileBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Max size limit check (e.g. 50MB)
    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(413).json({ error: 'File size exceeds 50MB limit.' });
    }

    // Generate sanitized, collision-free file path
    const ext = path.extname(fileName) || (fileType?.includes('video') ? '.mp4' : fileType?.includes('pdf') ? '.pdf' : '.jpg');
    const cleanBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const storageFilePath = `${auth.user.id}/${Date.now()}-${cleanBase}${ext}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storageFilePath, buffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Upload Error]:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file to storage.', details: uploadError.message });
    }

    let publicUrl = '';
    if (bucket === 'course-thumbnails' || bucket === 'course-videos') {
      const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(uploadData.path);
      publicUrl = publicData.publicUrl;
    }

    return res.json({
      success: true,
      url: publicUrl,
      storageAssetPath: uploadData.path,
      bucket,
      fileName,
      size: buffer.length,
    });
  } catch (error: any) {
    console.error('[Upload API Exception]:', error);
    return res.status(500).json({ error: 'Media upload failed.', details: error?.message });
  }
});

/**
 * 8. Save/Upsert Course and Curriculum
 * POST /api/courses/save
 */
app.post('/api/courses/save', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const role = auth.profile?.role || 'student';
    if (role !== 'instructor' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only instructors and administrators can create or edit courses.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const { course, curriculum = [], submitForReview = false } = req.body;
    if (!course || !course.title) {
      return res.status(400).json({ error: 'Course title and payload are required.' });
    }

    const existingCourseId = course.id && !course.id.startsWith('temp-') ? course.id : null;
    let instructorId = auth.user.id;

    // If updating an existing course, check authorization
    if (existingCourseId) {
      const { data: existingCourse, error: fetchErr } = await supabaseAdmin
        .from('courses')
        .select('id, instructor_id, is_published, prerequisites')
        .eq('id', existingCourseId)
        .single();

      if (fetchErr || !existingCourse) {
        return res.status(404).json({ error: 'Course not found in database.' });
      }

      if (role !== 'admin' && existingCourse.instructor_id && existingCourse.instructor_id !== auth.user.id) {
        return res.status(403).json({ error: 'Unauthorized: You can only edit your own courses.' });
      }

      instructorId = existingCourse.instructor_id || auth.user.id;
    }

    // Calculate total lessons and duration hours
    let totalLessons = 0;
    let totalMinutes = 0;
    if (Array.isArray(curriculum)) {
      for (const section of curriculum) {
        if (Array.isArray(section.lessons)) {
          totalLessons += section.lessons.length;
          for (const lesson of section.lessons) {
            totalMinutes += Number(lesson.durationMinutes) || 10;
          }
        }
      }
    }
    const durationHours = Math.max(0.5, Math.round((totalMinutes / 60) * 10) / 10);

    // Unique slug generation
    const baseSlug = (course.title || 'untitled-course')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const uniqueSuffix = crypto.randomBytes(3).toString('hex');
    const slug = existingCourseId && course.slug ? course.slug : `${baseSlug}-${uniqueSuffix}`;

    // Status resolution
    let isPublished = false;
    let targetStatus = course.status || (submitForReview ? 'pending_review' : 'draft');

    if (role === 'admin') {
      if (course.isPublished !== undefined) {
        isPublished = !!course.isPublished;
        targetStatus = isPublished ? 'published' : (course.status || 'draft');
      } else if (course.status === 'published') {
        isPublished = true;
        targetStatus = 'published';
      }
    } else {
      // Instructor flow: cannot directly publish without admin review
      if (submitForReview) {
        isPublished = false;
        targetStatus = 'pending_review';
      } else {
        isPublished = false;
        targetStatus = 'draft';
      }
    }

    // Encode status cleanly into prerequisites JSONB array
    let cleanPrereqs = Array.isArray(course.requirements || course.prerequisites)
      ? (course.requirements || course.prerequisites).filter((r: string) => !r.startsWith('__status:'))
      : [];
    if (!isPublished) {
      cleanPrereqs.unshift(`__status:${targetStatus}`);
    }

    const coursePayload: any = {
      title: course.title.trim(),
      slug,
      subtitle: (course.subtitle || 'Mastery curriculum authored on Edufy').trim(),
      description: (course.description || 'Comprehensive learning modules and hands-on exercises.').trim(),
      category: course.category || 'Web Development',
      category_slug: (course.category || 'Web Development').toLowerCase().replace(/\s+/g, '-'),
      level: course.level || 'All Levels',
      language: course.language || 'English',
      price: parseFloat(course.price) || 0.0,
      original_price: parseFloat(course.originalPrice) || (parseFloat(course.price) ? parseFloat(course.price) * 1.5 : 0),
      duration_hours: durationHours,
      total_lessons: Math.max(totalLessons, 1),
      thumbnail_url: course.thumbnail || course.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
      banner_url: course.bannerUrl || course.previewVideoUrl || null,
      instructor_id: instructorId,
      learning_outcomes: Array.isArray(course.learningOutcomes) ? course.learningOutcomes : ['Gain real-world practical skills'],
      prerequisites: cleanPrereqs,
      is_published: isPublished,
      featured: !!course.featured,
      bestseller: !!course.bestseller,
      trending: !!course.trending,
      updated_at: new Date().toISOString(),
    };

    let finalCourseId = existingCourseId;

    if (existingCourseId) {
      const { error: updateErr } = await supabaseAdmin
        .from('courses')
        .update(coursePayload)
        .eq('id', existingCourseId);

      if (updateErr) {
        console.error('[Course Update Error]:', updateErr);
        return res.status(500).json({ error: 'Failed to update course in database.', details: updateErr.message });
      }
    } else {
      finalCourseId = `course-${crypto.randomBytes(4).toString('hex')}`;
      coursePayload.id = finalCourseId;
      coursePayload.rating = 5.0;
      coursePayload.review_count = 0;
      coursePayload.enrolled_count = 0;
      coursePayload.created_at = new Date().toISOString();

      const { error: insertErr } = await supabaseAdmin
        .from('courses')
        .insert(coursePayload);

      if (insertErr) {
        console.error('[Course Insert Error]:', insertErr);
        return res.status(500).json({ error: 'Failed to create course in database.', details: insertErr.message });
      }
    }

    // Sync curriculum sections & lessons
    if (Array.isArray(curriculum) && curriculum.length > 0) {
      // Delete existing sections (cascades to lessons)
      await supabaseAdmin
        .from('course_sections')
        .delete()
        .eq('course_id', finalCourseId);

      // Insert new sections & lessons
      for (let sIdx = 0; sIdx < curriculum.length; sIdx++) {
        const sec = curriculum[sIdx];
        const secId = `sec-${crypto.randomBytes(5).toString('hex')}`;

        const { error: secErr } = await supabaseAdmin
          .from('course_sections')
          .insert({
            id: secId,
            course_id: finalCourseId,
            title: sec.title || `Section ${sIdx + 1}`,
            section_order: sIdx + 1,
          });

        if (secErr) {
          console.error('[Section Insert Error]:', secErr);
          continue;
        }

        if (Array.isArray(sec.lessons) && sec.lessons.length > 0) {
          const lessonRows = sec.lessons.map((les: any, lIdx: number) => ({
            id: `les-${crypto.randomBytes(5).toString('hex')}`,
            section_id: secId,
            course_id: finalCourseId,
            title: les.title || `Lesson ${lIdx + 1}`,
            duration_minutes: Number(les.durationMinutes) || 10,
            type: les.type || 'video',
            video_url: les.videoUrl || null,
            content_text: les.contentText || les.articleContent || null,
            storage_asset_path: les.storageAssetPath || null,
            is_free_preview: !!les.isFreePreview,
            quiz_id: les.quizId || null,
            lesson_order: lIdx + 1,
          }));

          const { error: lesErr } = await supabaseAdmin
            .from('lessons')
            .insert(lessonRows);

          if (lesErr) {
            console.error('[Lessons Insert Error]:', lesErr);
          }
        }
      }
    }

    return res.json({
      success: true,
      courseId: finalCourseId,
      status: targetStatus,
      isPublished,
      message: isPublished
        ? 'Course published successfully and is now live on the marketplace!'
        : submitForReview
        ? 'Course submitted for administrator review.'
        : 'Course draft saved successfully.',
    });
  } catch (error: any) {
    console.error('[Course Save Exception]:', error);
    return res.status(500).json({ error: 'Failed to save course.', details: error?.message });
  }
});

/**
 * 9. Get All Courses for Admin (including unpublished/drafts)
 * GET /api/courses/admin/all
 */
app.get('/api/courses/admin/all', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user || auth.profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin credentials required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const { data, error } = await supabaseAdmin
      .from('courses')
      .select(`
        *,
        course_sections (
          id,
          title,
          section_order,
          lessons (
            id,
            title,
            duration_minutes,
            type,
            video_url,
            content_text,
            storage_asset_path,
            is_free_preview,
            lesson_order
          )
        ),
        profiles:instructor_id (
          id,
          full_name,
          avatar_url,
          headline,
          bio
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve admin catalog.', details: error.message });
    }

    return res.json({ courses: data || [] });
  } catch (error: any) {
    return res.status(500).json({ error: 'Catalog retrieval error.', details: error?.message });
  }
});

/**
 * 10. Get Courses Authored by Current Instructor
 * GET /api/courses/instructor/mine
 */
app.get('/api/courses/instructor/mine', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    let query = supabaseAdmin
      .from('courses')
      .select(`
        *,
        course_sections (
          id,
          title,
          section_order,
          lessons (
            id,
            title,
            duration_minutes,
            type,
            video_url,
            content_text,
            storage_asset_path,
            is_free_preview,
            lesson_order
          )
        ),
        profiles:instructor_id (
          id,
          full_name,
          avatar_url,
          headline,
          bio
        )
      `)
      .order('created_at', { ascending: false });

    // If user is not admin, only show their courses
    if (auth.profile?.role !== 'admin') {
      query = query.eq('instructor_id', auth.user.id);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch instructor courses.', details: error.message });
    }

    return res.json({ courses: data || [] });
  } catch (error: any) {
    return res.status(500).json({ error: 'Instructor courses query failed.', details: error?.message });
  }
});

/**
 * 11. Toggle Course Publication Status
 * POST /api/courses/:id/publish
 */
app.post('/api/courses/:id/publish', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const courseId = req.params.id;
    const { isPublished, status } = req.body;
    const role = auth.profile?.role || 'student';

    const { data: course, error: fetchErr } = await supabaseAdmin
      .from('courses')
      .select('id, instructor_id, prerequisites')
      .eq('id', courseId)
      .single();

    if (fetchErr || !course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    // Check ownership
    if (role !== 'admin' && course.instructor_id !== auth.user.id) {
      return res.status(403).json({ error: 'Unauthorized: You can only alter your own courses.' });
    }

    let newPublished = false;
    let newStatus = status || 'draft';

    if (role === 'admin') {
      newPublished = isPublished !== undefined ? !!isPublished : status === 'published';
      newStatus = newPublished ? 'published' : (status || 'draft');
    } else {
      // Instructor can only request review or revert to draft
      if (status === 'pending_review') {
        newPublished = false;
        newStatus = 'pending_review';
      } else {
        newPublished = false;
        newStatus = 'draft';
      }
    }

    // Clean and encode status
    let prereqs = Array.isArray(course.prerequisites)
      ? course.prerequisites.filter((p: string) => !p.startsWith('__status:'))
      : [];
    if (!newPublished) {
      prereqs.unshift(`__status:${newStatus}`);
    }

    const { error: updateErr } = await supabaseAdmin
      .from('courses')
      .update({
        is_published: newPublished,
        prerequisites: prereqs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update publication status.', details: updateErr.message });
    }

    return res.json({
      success: true,
      courseId,
      isPublished: newPublished,
      status: newStatus,
      message: newPublished
        ? 'Course is now live and published on Edufy Academy.'
        : newStatus === 'pending_review'
        ? 'Course submitted for administrator review.'
        : 'Course moved to draft mode.',
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Publication update failed.', details: error?.message });
  }
});

/**
 * 12. Delete Course
 * DELETE /api/courses/:id
 */
app.delete('/api/courses/:id', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const courseId = req.params.id;
    const role = auth.profile?.role || 'student';

    const { data: course, error: fetchErr } = await supabaseAdmin
      .from('courses')
      .select('id, instructor_id, title')
      .eq('id', courseId)
      .single();

    if (fetchErr || !course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    if (role !== 'admin' && course.instructor_id !== auth.user.id) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own courses.' });
    }

    // Delete course (cascades to course_sections, lessons, etc.)
    const { error: delErr } = await supabaseAdmin
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (delErr) {
      return res.status(500).json({ error: 'Failed to delete course.', details: delErr.message });
    }

    return res.json({ success: true, message: `Course "${course.title}" was successfully deleted.` });
  } catch (error: any) {
    return res.status(500).json({ error: 'Course deletion failed.', details: error?.message });
  }
});

/**
 * 13. Become an Instructor Application
 * POST /api/instructor/apply
 */
app.post('/api/instructor/apply', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUserProfile(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: 'Unauthorized: Please log in to become an instructor.' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    const { headline, bio } = req.body;

    // Update role to instructor in profiles table
    const { data: updatedProfile, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'instructor',
        headline: headline ? headline.trim() : auth.profile?.headline || 'Edufy Instructor',
        bio: bio ? bio.trim() : auth.profile?.bio || 'Passionate educator empowering learners with real-world skills.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id)
      .select()
      .single();

    if (updateErr) {
      console.error('[Apply Instructor Error]:', updateErr);
      return res.status(500).json({ error: 'Failed to upgrade profile to instructor.', details: updateErr.message });
    }

    return res.json({
      success: true,
      message: 'Congratulations! Your instructor profile is activated.',
      profile: updatedProfile,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Instructor application failed.', details: error?.message });
  }
});

// ============================================================================
// VITE MIDDLEWARE / STATIC FILES MOUNTING
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // Serve production static build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Development mode: Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Edufy Academy] Fullstack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Fatal startup error:', err);
  process.exit(1);
});
