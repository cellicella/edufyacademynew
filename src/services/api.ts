import { Course, Instructor, BlogPost, Certificate, Quiz, Bundle } from '../types';
import { gradeQuizSubmission, QuizEvaluationResult } from '../utils/courseUtils';
import { supabase, isSupabaseConfigured, getAuthToken } from '../lib/supabase';
import { readJson } from '../lib/http';
import { categoryService, blogPublicService } from './content';

/**
 * Where the Express API lives. Priority:
 *  1. window.EDUFY_CONFIG.apiBaseUrl from /config.js — editable on the server after upload, no rebuild needed
 *  2. VITE_API_BASE_URL at build time
 *  3. '/api' on the same address as the website (single-app deployment)
 */
const runtimeApiBase = typeof window !== 'undefined' ? String((window as any).EDUFY_CONFIG?.apiBaseUrl || '').trim() : '';
export const API_BASE_URL = (
  runtimeApiBase ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  '/api'
).replace(/\/+$/, '');

/**
 * Row-level security only returns lesson *content* to enrolled learners (or free previews).
 * The public curriculum outline (titles, durations, types) comes from the get_course_outline RPC,
 * and is merged here so every visitor sees the full syllabus.
 */
async function attachCurriculumOutline(rows: any[]): Promise<any[]> {
  if (!rows.length) return rows;
  try {
    const { data: outline, error } = await supabase.rpc('get_course_outline', { p_course_ids: rows.map((r) => r.id) });
    if (error || !outline) return rows;
    const bySection: Record<string, any[]> = {};
    for (const l of outline as any[]) (bySection[l.section_id] ||= []).push(l);
    return rows.map((row) => ({
      ...row,
      course_sections: (row.course_sections || []).map((sec: any) => {
        const accessible = new Map((sec.lessons || []).map((l: any) => [l.id, l]));
        const outlineLessons = bySection[sec.id] || [];
        const merged = outlineLessons.map((o) => ({ ...o, ...(accessible.get(o.id) || {}) }));
        // keep any accessible lessons not in the outline (shouldn't happen, but be safe)
        for (const l of sec.lessons || []) if (!outlineLessons.some((o) => o.id === l.id)) merged.push(l);
        return { ...sec, lessons: merged };
      }),
    }));
  } catch {
    return rows;
  }
}

function mapSupabaseCourse(item: any): Course {
  const prereqs = Array.isArray(item.prerequisites) ? item.prerequisites : [];
  let status: 'draft' | 'pending_review' | 'published' | 'rejected' = item.is_published ? 'published' : 'draft';
  const statusPrereq = prereqs.find((p: string) => typeof p === 'string' && p.startsWith('__status:'));
  if (statusPrereq) {
    status = statusPrereq.replace('__status:', '') as any;
  }
  const cleanRequirements = prereqs.filter((p: string) => typeof p === 'string' && !p.startsWith('__status:'));

  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    category: item.category,
    categorySlug: item.category_slug,
    level: item.level,
    language: item.language,
    price: parseFloat(item.price) || 0,
    originalPrice: parseFloat(item.original_price) || 0,
    rating: parseFloat(item.rating) || 5.0,
    reviewCount: item.review_count || 0,
    enrolledCount: item.enrolled_count || 0,
    durationHours: parseFloat(item.duration_hours) || 0,
    totalLessons: item.total_lessons || 0,
    thumbnail: item.thumbnail_url || '',
    previewVideoUrl: item.banner_url || '',
    featured: !!item.featured,
    bestseller: !!item.bestseller,
    trending: !!item.trending,
    isPublished: !!item.is_published,
    status,
    instructorId: item.instructor_id || '',
    instructor: {
      id: item.profiles?.id || item.instructor_id || '',
      name: item.profiles?.full_name || 'Edufy Instructor',
      title: item.profiles?.headline || 'Lead Instructor',
      company: 'Edufy Academy',
      avatar:
        item.profiles?.avatar_url ||
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
      rating: parseFloat(item.rating) || 5.0,
      totalStudents: item.enrolled_count || 0,
      coursesCount: 1,
      bio: item.profiles?.bio || '',
    },
    learningOutcomes: Array.isArray(item.learning_outcomes) ? item.learning_outcomes : [],
    requirements: cleanRequirements,
    targetAudience: Array.isArray(item.target_audience) ? item.target_audience : [],
    certificateOffered: true,
    curriculum: [...(item.course_sections || [])]
      .sort((a: any, b: any) => (a.section_order || 0) - (b.section_order || 0))
      .map((sec: any) => ({
        id: sec.id,
        title: sec.title,
        order: sec.section_order || 1,
        lessons: [...(sec.lessons || [])]
          .sort((a: any, b: any) => (a.lesson_order || 0) - (b.lesson_order || 0))
          .map((l: any) => {
            const quizRow = Array.isArray(l.quizzes) ? l.quizzes[0] : l.quizzes;
            return {
              id: l.id,
              title: l.title,
              durationMinutes: l.duration_minutes || 10,
              type: l.type || 'video',
              videoUrl: l.video_url || '',
              contentText: l.content_text || '',
              storageAssetPath: l.storage_asset_path || '',
              isFreePreview: !!l.is_free_preview,
              quizId: l.quiz_id || undefined,
              resources: Array.isArray(l.resources) ? l.resources : [],
              adiloFileId: l.adilo_file_id || null,
              adiloEmbedUrl: l.adilo_embed_url || null,
              videoTitle: l.video_title || null,
              videoDuration: l.video_duration ?? null,
              videoStatus: l.video_status || null,
              quiz: quizRow
                ? {
                    id: quizRow.id,
                    title: quizRow.title,
                    passingScorePercent: quizRow.passing_score_percentage || 70,
                    questions: [...(quizRow.quiz_questions || [])]
                      .sort((a: any, b: any) => (a.question_order || 0) - (b.question_order || 0))
                      .map((q: any) => ({
                        id: q.id,
                        question: q.question,
                        options: Array.isArray(q.options) ? q.options : [],
                        correctOptionIndex: q.correct_option_index ?? 0,
                        explanation: q.explanation || '',
                      })),
                  }
                : undefined,
            };
          }),
      })),
    reviews: [],
    lastUpdated: 'Recently updated',
  };
}

export const courseService = {
  async getAllCourses(filters?: {
    category?: string;
    level?: string;
    search?: string;
    sort?: string;
    priceFilter?: string;
  }): Promise<Course[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
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
          .eq('is_published', true);

        if (filters?.category && filters.category !== 'all') {
          query = query.eq('category_slug', filters.category);
        }

        if (filters?.level && filters.level !== 'all') {
          query = query.ilike('level', filters.level);
        }

        if (filters?.search) {
          query = query.or(`title.ilike.%${filters.search}%,subtitle.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;

        if (error) {
          console.warn('[Edufy API] Supabase courses query error:', error);
          return [];
        }

        if (!data || data.length === 0) {
          return [];
        }

        let result = (await attachCurriculumOutline(data)).map(mapSupabaseCourse);

        if (filters?.priceFilter) {
          if (filters.priceFilter === 'under-35') {
            result = result.filter((c) => c.price < 35);
          } else if (filters.priceFilter === 'discounted') {
            result = result.filter((c) => c.originalPrice > c.price);
          }
        }

        if (filters?.sort) {
          if (filters.sort === 'highest-rated') {
            result.sort((a, b) => b.rating - a.rating);
          } else if (filters.sort === 'price-low') {
            result.sort((a, b) => a.price - b.price);
          } else if (filters.sort === 'price-high') {
            result.sort((a, b) => b.price - a.price);
          } else if (filters.sort === 'popular') {
            result.sort((a, b) => b.enrolledCount - a.enrolledCount);
          }
        }

        return result;
      } catch (err) {
        console.warn('[Edufy API] Supabase courses fetch error:', err);
        return [];
      }
    }

    return [];
  },

  async getCourseById(id: string): Promise<Course | null> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select(`
            *,
            course_sections (
              id,
              title,
              section_order,
              lessons ( * )
            ),
            profiles:instructor_id (
              id,
              full_name,
              avatar_url,
              headline,
              bio
            )
          `)
          .or(`id.eq.${id},slug.eq.${id}`)
          .maybeSingle();

        if (error) {
          console.warn('[Edufy API] Course by id query error:', error);
          return null;
        }

        if (data) {
          const [withOutline] = await attachCurriculumOutline([data]);
          return mapSupabaseCourse(withOutline);
        }
      } catch (err) {
        console.warn('[Edufy API] Course fetch exception:', err);
      }
    }

    return null;
  },

  async getCourseReviews(courseId: string) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*, profiles(full_name, avatar_url)')
          .eq('course_id', courseId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((r: any) => ({
            id: r.id,
            userName: r.profiles?.full_name || 'Verified Student',
            userAvatar:
              r.profiles?.avatar_url ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80',
            rating: r.rating,
            comment: r.comment,
            date: new Date(r.created_at).toLocaleDateString(),
          }));
        }
      } catch (err) {
        console.warn('[Edufy API] Fetch course reviews error:', err);
      }
    }
    return [];
  },

  /**
   * Save / Upsert Course and Curriculum
   */
  async saveCourse(
    course: Partial<Course>,
    curriculum: any[],
    submitForReview = false
  ): Promise<{ success: boolean; courseId: string; status: string; isPublished: boolean; message: string }> {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/courses/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ course, curriculum, submitForReview }),
    });

    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save course.');
    }
    return data;
  },

  /**
   * Delete Course
   */
  async deleteCourse(courseId: string): Promise<{ success: boolean; message: string }> {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/courses/${courseId}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete course.');
    }
    return data;
  },

  /**
   * Publish or change course status
   */
  async publishCourse(
    courseId: string,
    isPublished: boolean,
    status?: 'draft' | 'pending_review' | 'published' | 'rejected'
  ): Promise<{ success: boolean; isPublished: boolean; status: string; message: string }> {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/courses/${courseId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ isPublished, status }),
    });

    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update publication status.');
    }
    return data;
  },

  /**
   * Retrieve Admin All Courses (drafts, pending, published)
   */
  async getAdminCourses(): Promise<Course[]> {
    // Read straight from Supabase (RLS lets admins see every course, section, lesson and quiz),
    // so this page works even when the Express API isn't deployed next to the website.
    if (!isSupabaseConfigured) throw new Error('The database is not configured for this website.');
    const { data, error } = await supabase.from('courses').select(MANAGE_COURSE_SELECT).order('created_at', { ascending: false });
    if (error) throw new Error(`Could not load the course catalog: ${error.message}`);
    return (data || []).map(mapSupabaseCourse);
  },

  /**
   * Retrieve Courses Authored by Current User (RLS: instructors see their own drafts too)
   */
  async getInstructorCourses(): Promise<Course[]> {
    if (!isSupabaseConfigured) throw new Error('The database is not configured for this website.');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Please sign in again.');
    const { data, error } = await supabase
      .from('courses')
      .select(MANAGE_COURSE_SELECT)
      .eq('instructor_id', auth.user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Could not load your courses: ${error.message}`);
    return (data || []).map(mapSupabaseCourse);
  },

  /**
   * Upload Media (Thumbnail, Video, Material)
   */
  async uploadMedia(
    file: File,
    bucket: 'course-thumbnails' | 'course-videos' | 'course-materials'
  ): Promise<{ success: boolean; url: string; storageAssetPath: string; fileName: string; size: number }> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required for uploading media.');
    }

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileBase64: base64Data,
        fileName: file.name,
        fileType: file.type,
        bucket,
      }),
    });

    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload media file.');
    }
    return data;
  },

  /**
   * Apply to become an instructor
   */
  async applyToBecomeInstructor(payload: { headline?: string; bio?: string; expertise?: string; website?: string }): Promise<{ success: boolean; message: string; status?: string; profile?: any }> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required.');
    }

    const res = await fetch(`${API_BASE_URL}/instructor/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit instructor application.');
    }
    return data;
  },

  /** Course categories from the database (managed in Admin → Categories), with published-course counts. */
  async getCategories() {
    try {
      const cats = await categoryService.listPublic();
      return cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon || 'BookOpen', description: c.description, imageUrl: c.imageUrl, courseCount: c.courseCount }));
    } catch (err) {
      console.warn('[Edufy API] Could not load categories:', err);
      return [];
    }
  },
};

export const instructorService = {
  async getAllInstructors(): Promise<Instructor[]> {
    if (isSupabaseConfigured) {
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'instructor');

        if (!error && profiles) {
          const { data: courses } = await supabase
            .from('courses')
            .select('id, instructor_id, rating, enrolled_count')
            .eq('is_published', true);

          return profiles.map((p) => {
            const instCourses = (courses || []).filter((c) => c.instructor_id === p.id);
            const totalStudents = instCourses.reduce((sum, c) => sum + (c.enrolled_count || 0), 0);
            const avgRating =
              instCourses.length > 0
                ? Number(
                    (
                      instCourses.reduce((sum, c) => sum + (parseFloat(c.rating) || 5), 0) /
                      instCourses.length
                    ).toFixed(2)
                  )
                : 5.0;

            return {
              id: p.id,
              name: p.full_name,
              title: p.headline || 'Edufy Instructor',
              company: 'Edufy Academy',
              avatar:
                p.avatar_url ||
                'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
              rating: avgRating,
              totalStudents,
              coursesCount: instCourses.length,
              bio: p.bio || '',
            };
          });
        }
      } catch (err) {
        console.warn('[Edufy API] Supabase query for instructors failed:', err);
      }
    }
    return [];
  },

  async getInstructorById(id: string): Promise<Instructor | null> {
    if (isSupabaseConfigured) {
      try {
        const { data: p, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && p) {
          const { data: courses } = await supabase
            .from('courses')
            .select('id, instructor_id, rating, enrolled_count')
            .eq('instructor_id', p.id)
            .eq('is_published', true);

          const instCourses = courses || [];
          const totalStudents = instCourses.reduce((sum, c) => sum + (c.enrolled_count || 0), 0);
          const avgRating =
            instCourses.length > 0
              ? Number(
                  (
                    instCourses.reduce((sum, c) => sum + (parseFloat(c.rating) || 5), 0) /
                    instCourses.length
                  ).toFixed(2)
                )
              : 5.0;

          return {
            id: p.id,
            name: p.full_name,
            title: p.headline || 'Edufy Instructor',
            company: 'Edufy Academy',
            avatar:
              p.avatar_url ||
              'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
            rating: avgRating,
            totalStudents,
            coursesCount: instCourses.length,
            bio: p.bio || '',
          };
        }
      } catch (err) {
        console.warn('[Edufy API] Supabase query for instructor failed:', err);
      }
    }
    return null;
  },

  async getDashboardMetrics(instructorId?: string) {
    if (isSupabaseConfigured) {
      try {
        let coursesQuery = supabase.from('courses').select('id, enrolled_count, rating, price');
        if (instructorId) {
          coursesQuery = coursesQuery.eq('instructor_id', instructorId);
        }
        const { data: courses } = await coursesQuery;
        const instCourses = courses || [];
        const totalEnrollments = instCourses.reduce((sum, c) => sum + (c.enrolled_count || 0), 0);
        const totalEarnings = instCourses.reduce(
          (sum, c) => sum + (c.enrolled_count || 0) * (parseFloat(c.price) || 0),
          0
        );
        const avgRating =
          instCourses.length > 0
            ? Number(
                (
                  instCourses.reduce((sum, c) => sum + (parseFloat(c.rating) || 5), 0) /
                  instCourses.length
                ).toFixed(2)
              )
            : 0;

        const { data: payments } = await supabase
          .from('payments')
          .select('id, amount, created_at, profiles(full_name), courses(title)')
          .eq('status', 'captured')
          .order('created_at', { ascending: false })
          .limit(5);

        const recentSales = (payments || []).map((p: any) => ({
          id: p.id,
          studentName: p.profiles?.full_name || 'Enrolled Student',
          courseTitle: p.courses?.title || 'Masterclass',
          amount: parseFloat(p.amount) || 0,
          date: new Date(p.created_at).toLocaleDateString(),
        }));

        return {
          totalEarnings,
          thisMonthEarnings: Math.round(totalEarnings * 0.15),
          activeStudents: totalEnrollments,
          totalEnrollments,
          averageCourseRating: avgRating || 5.0,
          recentSales,
        };
      } catch (err) {
        console.warn('[Edufy API] Failed to fetch instructor metrics:', err);
      }
    }

    return {
      totalEarnings: 0,
      thisMonthEarnings: 0,
      activeStudents: 0,
      totalEnrollments: 0,
      averageCourseRating: 0,
      recentSales: [],
    };
  },

  async getInstructorStudents(instructorId?: string) {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('enrollments')
          .select(`
            id,
            status,
            enrolled_at,
            profiles(id, full_name, email, avatar_url),
            courses!inner(id, title, instructor_id, total_lessons)
          `);

        if (instructorId) {
          query = query.eq('courses.instructor_id', instructorId);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((e: any) => ({
            id: e.profiles?.id || e.id,
            name: e.profiles?.full_name || 'Student',
            email: e.profiles?.email || '',
            avatar:
              e.profiles?.avatar_url ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
            enrolledIn: e.courses?.title || 'Masterclass',
            progress: e.status === 'completed' ? 100 : 0,
            lastActive: new Date(e.enrolled_at).toLocaleDateString(),
          }));
        }
      } catch (err) {
        console.warn('[Instructor API] Failed to fetch students:', err);
      }
    }
    return [];
  },
};

export const blogService = {
  /** Published posts (same records the mobile app shows). */
  async getAllPosts(): Promise<BlogPost[]> {
    const posts = await blogPublicService.list();
    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.contentHtml,
      author: { name: p.authorName, avatar: p.authorAvatarUrl || '', role: p.authorRole },
      date: p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      readTime: `${p.readingMinutes} min read`,
      category: p.category || '',
      tags: p.tags,
    }));
  },

  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    const p = await blogPublicService.get(slug);
    if (!p) return null;
    return {
      id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.contentHtml,
      author: { name: p.authorName, avatar: p.authorAvatarUrl || '', role: p.authorRole },
      date: p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      readTime: `${p.readingMinutes} min read`, category: p.category || '', tags: p.tags,
    };
  },
};

export const certificateService = {
  /**
   * Verify certificate credential publicly through backend API
   */
  async verifyCertificate(code: string): Promise<{ valid: boolean; certificate: Certificate | null; error?: string }> {
    try {
      const res = await fetch(`/api/certificates/verify/${encodeURIComponent(code)}`);
      const data = await readJson(res);
      if (res.ok && data.valid && data.certificate) {
        const cert = data.certificate;
        return {
          valid: true,
          certificate: {
            id: cert.id || cert.certificate_code || cert.certificateCode,
            certificateCode: cert.certificate_code || cert.certificateCode,
            studentName: cert.student_name || cert.studentName,
            studentId: cert.user_id || '',
            courseTitle: cert.course_title || cert.courseTitle,
            courseId: cert.course_id || '',
            instructorName: cert.instructor_name || cert.instructorName,
            issueDate: cert.issue_date || cert.issueDate,
            gradeScore: cert.grade_percentage || cert.gradeScore || 100,
            verificationHash: cert.verification_hash || cert.verificationHash,
          },
        };
      }
      return {
        valid: false,
        certificate: null,
        error: data.error || 'No verified record found matching this credential identifier.',
      };
    } catch {
      return {
        valid: false,
        certificate: null,
        error: 'No verified record found matching this credential identifier.',
      };
    }
  },

  /**
   * Claim certificate once course is 100% completed
   */
  async claimCertificate(courseId: string): Promise<{ success: boolean; certificate?: Certificate; error?: string }> {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/certificates/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ courseId }),
      });

      const data = await readJson(res);
      if (res.ok && data.success && data.certificate) {
        const c = data.certificate;
        return {
          success: true,
          certificate: {
            id: c.id || c.certificate_code,
            certificateCode: c.certificate_code || c.certificateCode,
            studentName: c.student_name || c.studentName,
            studentId: c.user_id || '',
            courseTitle: c.course_title || c.courseTitle,
            courseId: c.course_id || courseId,
            instructorName: c.instructor_name || c.instructorName,
            issueDate: c.issue_date || c.issueDate,
            gradeScore: c.grade_percentage || c.gradeScore || 100,
            verificationHash: c.verification_hash || c.verificationHash,
          },
        };
      }
      return { success: false, error: data.error || 'Failed to claim certificate.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getStudentCertificates(studentId: string): Promise<Certificate[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('certificates')
          .select('*')
          .eq('user_id', studentId);

        if (!error && data) {
          return data.map((c) => ({
            id: c.id,
            certificateCode: c.certificate_code,
            studentName: c.student_name,
            studentId: c.user_id,
            courseTitle: c.course_title,
            courseId: c.course_id,
            instructorName: c.instructor_name,
            issueDate: c.issue_date,
            gradeScore: c.grade_percentage || 100,
            verificationHash: c.verification_hash,
          }));
        }
      } catch (err) {
        console.warn('[Certificates] Supabase fetch error:', err);
      }
    }

    return [];
  },
};

export const quizService = {
  async getQuizById(quizId: string): Promise<Quiz | null> {
    if (isSupabaseConfigured) {
      try {
        const { data: quizData, error: qError } = await supabase
          .from('quizzes')
          .select('*, quiz_questions(*)')
          .eq('id', quizId)
          .maybeSingle();

        if (!qError && quizData) {
          const sortedQuestions = (quizData.quiz_questions || []).sort(
            (a: any, b: any) => a.question_order - b.question_order
          );

          return {
            id: quizData.id,
            title: quizData.title,
            passingScorePercent: quizData.passing_score_percentage || 80,
            questions: sortedQuestions.map((q: any) => ({
              id: q.id,
              question: q.question,
              options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
              correctOptionIndex: q.correct_option_index,
              explanation: q.explanation || '',
            })),
          };
        }
      } catch (err) {
        console.warn('[Quiz] Supabase quiz query error:', err);
      }
    }

    return null;
  },

  async submitQuiz(quizId: string, answers: Record<string, number>): Promise<QuizEvaluationResult> {
    const quiz = await quizService.getQuizById(quizId);
    if (!quiz) {
      throw new Error(`Quiz not found: ${quizId}`);
    }
    const result = gradeQuizSubmission(quiz, answers);

    if (isSupabaseConfigured) {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session.session?.user) {
          await supabase.from('quiz_attempts').insert({
            user_id: session.session.user.id,
            quiz_id: quizId,
            score_percentage: result.scorePercent,
            passed: result.passed,
            answers,
          });
        }
      } catch (err) {
        console.warn('[Quiz] Attempt recording failed:', err);
      }
    }

    return result;
  },
};

export const adminService = {
  async getPlatformAnalytics() {
    if (isSupabaseConfigured) {
      try {
        const [
          { count: totalUsers },
          { count: activeStudents },
          { count: certifiedInstructors },
          { count: totalCourses },
          { data: payments },
          { count: totalEnrollments },
          { count: completedEnrollments },
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'instructor'),
          supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true),
          supabase.from('payments').select('amount').eq('status', 'captured'),
          supabase.from('enrollments').select('id', { count: 'exact', head: true }),
          supabase.from('enrollments').select('id', { count: 'exact', head: true }).not('completed_at', 'is', null),
        ]);

        const grossRevenue = (payments || []).reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        const completionRate =
          totalEnrollments && totalEnrollments > 0
            ? Number((((completedEnrollments || 0) / totalEnrollments) * 100).toFixed(1))
            : 0;

        return {
          totalUsers: totalUsers || 0,
          activeStudents: activeStudents || 0,
          certifiedInstructors: certifiedInstructors || 0,
          totalCourses: totalCourses || 0,
          monthlyGrossRevenue: grossRevenue,
          averageCompletionRate: completionRate,
          userGrowthMonthly: '+0%',
          revenueGrowthMonthly: '+0%',
        };
      } catch (err) {
        console.warn('[Edufy API] Admin platform analytics error:', err);
      }
    }

    return {
      totalUsers: 0,
      activeStudents: 0,
      certifiedInstructors: 0,
      totalCourses: 0,
      monthlyGrossRevenue: 0,
      averageCompletionRate: 0,
      userGrowthMonthly: '+0%',
      revenueGrowthMonthly: '+0%',
    };
  },

  async getAllUsers() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            email,
            role,
            created_at,
            enrollments(id)
          `)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((u: any) => ({
            id: u.id,
            name: u.full_name,
            email: u.email,
            role: u.role,
            enrolled: u.enrollments ? u.enrollments.length : 0,
            status: 'Active',
            joined: new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
          }));
        }
      } catch (err) {
        console.warn('[Admin API] Error fetching users:', err);
      }
    }
    return [];
  },

  async getAllTransactions() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('payments')
          .select(`
            id,
            razorpay_order_id,
            amount,
            status,
            created_at,
            profiles(full_name),
            courses(title)
          `)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((t: any) => {
            const gross = parseFloat(t.amount) || 0;
            const fee = Number((gross * 0.1).toFixed(2));
            const payout = Number((gross - fee).toFixed(2));
            return {
              id: t.id.substring(0, 8).toUpperCase(),
              user: t.profiles?.full_name || 'Student',
              course: t.courses?.title || 'Course Masterclass',
              amount: gross,
              fee,
              payout,
              status: t.status === 'captured' ? 'Settled' : t.status,
              date: new Date(t.created_at).toLocaleDateString(),
            };
          });
        }
      } catch (err) {
        console.warn('[Admin API] Error fetching transactions:', err);
      }
    }
    return [];
  },
};

export interface PaymentRecord {
  id: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  amount: number;
  currency: string;
  status: 'created' | 'captured' | 'failed' | 'refunded';
  receipt: string;
  created_at: string;
  notes?: Record<string, any>;
  courses?: {
    id: string;
    title: string;
    thumbnail_url?: string;
    category?: string;
  };
}

export const paymentService = {
  async getPaymentHistory(): Promise<PaymentRecord[]> {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/payments/history', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await readJson(res);
        return data.payments || [];
      }
      return [];
    } catch (err) {
      console.warn('[Payments API] fetch history error:', err);
      return [];
    }
  },
};

export const storageService = {
  async getDownloadUrl(courseId: string, filePath: string): Promise<string | null> {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ courseId, filePath }),
      });
      if (res.ok) {
        const data = await readJson(res);
        return data.signedUrl || null;
      }
      return null;
    } catch (err) {
      console.warn('[Storage API] signed url error:', err);
      return null;
    }
  },
};


/* ============================================================================
 * Bundles
 * ========================================================================== */
/** Full course tree for admin / instructor management screens (same shape the API returned). */
const MANAGE_COURSE_SELECT = `
  *,
  course_sections ( id, title, section_order, lessons ( *, quizzes ( id, title, passing_score_percentage, quiz_questions ( id, question, options, correct_option_index, explanation, question_order ) ) ) ),
  profiles:instructor_id ( id, full_name, avatar_url, headline, bio )
`;

const COURSE_SELECT = `
  *,
  course_sections ( id, title, section_order, lessons ( id, title, duration_minutes, type, video_url, is_free_preview, lesson_order ) ),
  profiles:instructor_id ( id, full_name, avatar_url, headline, bio )
`;

function mapBundle(b: any): Bundle {
  const courses: Course[] = [...(b.bundle_courses || [])]
    .sort((x: any, y: any) => (x.position || 0) - (y.position || 0))
    .map((bc: any) => bc.courses)
    .filter(Boolean)
    .map(mapSupabaseCourse);
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    subtitle: b.subtitle || '',
    description: b.description || '',
    thumbnail: b.thumbnail_url || courses[0]?.thumbnail || '',
    price: parseFloat(b.price) || 0,
    isPublished: !!b.is_published,
    courses,
    coursesValue: courses.reduce((sum, c) => sum + (c.price || 0), 0),
  };
}

export interface BundleInput {
  id?: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnail: string;
  price: number;
  isPublished: boolean;
  courseIds: string[];
}

export const bundleService = {
  async getPublishedBundles(): Promise<Bundle[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('bundles')
      .select(`*, bundle_courses ( position, courses ( ${COURSE_SELECT} ) )`)
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[Bundles] fetch error:', error.message);
      return [];
    }
    return (data || []).map(mapBundle);
  },

  async getBundle(idOrSlug: string): Promise<Bundle | null> {
    if (!isSupabaseConfigured) return null;
    const { data } = await supabase
      .from('bundles')
      .select(`*, bundle_courses ( position, courses ( ${COURSE_SELECT} ) )`)
      .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
      .maybeSingle();
    return data ? mapBundle(data) : null;
  },

  /** Admin: every bundle including drafts (RLS restricts this to admins). */
  async getAllBundles(): Promise<Bundle[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('bundles')
      .select(`*, bundle_courses ( position, courses ( ${COURSE_SELECT} ) )`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapBundle);
  },

  async saveBundle(input: BundleInput): Promise<string> {
    const baseSlug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'bundle';
    const row: any = {
      title: input.title.trim(),
      subtitle: input.subtitle.trim(),
      description: input.description.trim(),
      thumbnail_url: input.thumbnail || null,
      price: Math.max(0, Number(input.price) || 0),
      is_published: input.isPublished,
      updated_at: new Date().toISOString(),
    };
    let bundleId = input.id;
    if (bundleId) {
      const { error } = await supabase.from('bundles').update(row).eq('id', bundleId);
      if (error) throw new Error(error.message);
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('bundles')
        .insert({ ...row, slug: `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`, created_by: auth.user?.id })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      bundleId = data.id;
    }
    const { error: delErr } = await supabase.from('bundle_courses').delete().eq('bundle_id', bundleId);
    if (delErr) throw new Error(delErr.message);
    if (input.courseIds.length) {
      const { error: insErr } = await supabase
        .from('bundle_courses')
        .insert(input.courseIds.map((courseId, i) => ({ bundle_id: bundleId, course_id: courseId, position: i + 1 })));
      if (insErr) throw new Error(insErr.message);
    }
    return bundleId!;
  },

  async deleteBundle(id: string): Promise<void> {
    const { error } = await supabase.from('bundles').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

/* ============================================================================
 * Admin console data (all backed by admin-only RPCs / RLS)
 * ========================================================================== */
export interface RevenueSummary {
  instructor_share: number;
  gross_revenue: number;
  refunded: number;
  transactions: number;
  failed_transactions: number;
  paying_students: number;
  bundle_revenue: number;
  by_month: { month: string; revenue: number; transactions: number }[];
  by_course: { course_id: string; title: string; instructor: string | null; sales: number; revenue: number }[];
  recent: { id: string; order_id: string; amount: number; status: string; created_at: string; student: string; email: string; item: string }[];
}

export interface InstructorOverviewRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
  headline: string;
  joined_at: string;
  courses: number;
  published_courses: number;
  pending_courses: number;
  students: number;
  gross_revenue: number;
  instructor_earnings: number;
  avg_rating: number | null;
}

export interface InstructorApplication {
  id: string;
  user_id: string;
  headline: string;
  bio: string;
  expertise: string;
  website: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  applicant?: { full_name: string; email: string; avatar_url: string; created_at: string } | null;
}

export interface StudentOverviewRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
  joined_at: string;
  enrollments: number;
  completed_courses: number;
  lessons_completed: number;
  avg_progress: number;
  total_spent: number;
  last_active: string | null;
}

export interface StudentDetail {
  profile: { id: string; full_name: string; email: string; phone: string | null; avatar_url: string; headline: string; joined_at: string } | null;
  courses: {
    course_id: string;
    title: string;
    thumbnail_url: string;
    enrolled_at: string;
    status: string;
    via_bundle: string | null;
    total_lessons: number;
    completed_lessons: number;
    last_activity: string | null;
    best_quiz_score: number | null;
    certificate_code: string | null;
  }[];
  payments: { order_id: string; amount: number; status: string; created_at: string; item: string }[];
}

const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));

export const adminConsoleService = {
  async getRevenueSummary(): Promise<RevenueSummary> {
    const { data, error } = await supabase.rpc('admin_revenue_summary');
    if (error) throw new Error(error.message);
    const d: any = data || {};
    return {
      instructor_share: num(d.instructor_share) || 0.7,
      gross_revenue: num(d.gross_revenue),
      refunded: num(d.refunded),
      transactions: num(d.transactions),
      failed_transactions: num(d.failed_transactions),
      paying_students: num(d.paying_students),
      bundle_revenue: num(d.bundle_revenue),
      by_month: (d.by_month || []).map((m: any) => ({ month: m.month, revenue: num(m.revenue), transactions: num(m.transactions) })),
      by_course: (d.by_course || []).map((c: any) => ({ ...c, sales: num(c.sales), revenue: num(c.revenue) })),
      recent: (d.recent || []).map((r: any) => ({ ...r, amount: num(r.amount) })),
    };
  },

  async getInstructors(): Promise<InstructorOverviewRow[]> {
    const { data, error } = await supabase.rpc('admin_instructor_overview');
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      ...r,
      courses: num(r.courses),
      published_courses: num(r.published_courses),
      pending_courses: num(r.pending_courses),
      students: num(r.students),
      gross_revenue: num(r.gross_revenue),
      instructor_earnings: num(r.instructor_earnings),
      avg_rating: r.avg_rating === null ? null : Number(r.avg_rating),
    }));
  },

  async getApplications(): Promise<InstructorApplication[]> {
    const { data, error } = await supabase
      .from('instructor_applications')
      .select('*, applicant:profiles!instructor_applications_user_id_fkey ( full_name, email, avatar_url, created_at )')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as InstructorApplication[];
  },

  async reviewApplication(applicationId: string, approve: boolean, note?: string): Promise<void> {
    const { error } = await supabase.rpc('review_instructor_application', {
      p_application_id: applicationId,
      p_approve: approve,
      p_note: note || null,
    });
    if (error) throw new Error(error.message);
  },

  async setUserRole(userId: string, role: 'student' | 'instructor'): Promise<void> {
    const { error } = await supabase.rpc('admin_set_user_role', { p_user_id: userId, p_role: role });
    if (error) throw new Error(error.message);
  },

  async getStudents(): Promise<StudentOverviewRow[]> {
    const { data, error } = await supabase.rpc('admin_student_overview');
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      ...r,
      enrollments: num(r.enrollments),
      completed_courses: num(r.completed_courses),
      lessons_completed: num(r.lessons_completed),
      avg_progress: num(r.avg_progress),
      total_spent: num(r.total_spent),
    }));
  },

  async getStudentDetail(userId: string): Promise<StudentDetail> {
    const { data, error } = await supabase.rpc('admin_student_detail', { p_user_id: userId });
    if (error) throw new Error(error.message);
    const d: any = data || {};
    return {
      profile: d.profile || null,
      courses: (d.courses || []).map((c: any) => ({ ...c, total_lessons: num(c.total_lessons), completed_lessons: num(c.completed_lessons) })),
      payments: (d.payments || []).map((p: any) => ({ ...p, amount: num(p.amount) })),
    };
  },

  async getInstructorShare(): Promise<number> {
    const { data } = await supabase.from('platform_settings').select('value').eq('key', 'instructor_revenue_share').maybeSingle();
    return data ? Number(data.value) : 0.7;
  },

  async setInstructorShare(share: number): Promise<void> {
    const value = Math.min(1, Math.max(0, share));
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key: 'instructor_revenue_share', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
  },
};

/** The signed-in user's own instructor application (if any). */
export async function getMyInstructorApplication(): Promise<InstructorApplication | null> {
  if (!isSupabaseConfigured) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from('instructor_applications').select('*').eq('user_id', auth.user.id).maybeSingle();
  return (data as InstructorApplication) || null;
}


/* ============================================================================
 * Adilo video hosting (all Adilo API calls go through the Express backend)
 * ========================================================================== */
async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await readJson(res).catch(() => ({} as any));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

export interface AdiloUploadResult {
  fileId: string;
  projectId: string;
  title: string;
  durationSeconds: number;
  durationFormatted: string | null;
  embedUrl: string | null;
  status: string;
}

export interface LessonVideoAccess {
  embedUrl: string;
  playerOrigin: string;
  title: string | null;
  durationSeconds: number | null;
  status: string | null;
  progress: { last_position_seconds: number; watched_seconds: number; is_completed: boolean } | null;
}

export const adiloService = {
  status: () => authedFetch('/adilo/status') as Promise<{ configured: boolean; partSize: number; maxFileBytes: number }>,

  start: (body: { filename: string; filesize: number; durationSeconds: number; mimeType: string; courseId?: string | null }) =>
    authedFetch('/adilo/upload/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) as Promise<{
      uploadId: string;
      key: string;
      partSize: number;
      totalParts: number;
    }>,

  signPart: (uploadId: string, partNumber: number) =>
    authedFetch(`/adilo/upload/sign?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`) as Promise<{ url: string; method: string }>,

  proxyPart: async (uploadId: string, partNumber: number, blob: Blob, onProgress?: (loaded: number) => void): Promise<string> => {
    const token = await getAuthToken();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/adilo/upload/part?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => onProgress?.(e.loaded);
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && data.ETag) resolve(data.ETag);
          else reject(new Error(data.error || `Part ${partNumber} failed (${xhr.status})`));
        } catch {
          reject(new Error(`Part ${partNumber} failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error(`Network error uploading part ${partNumber}`));
      xhr.send(blob);
    });
  },

  complete: (uploadId: string, parts: { PartNumber: number; ETag: string }[]) =>
    authedFetch('/adilo/upload/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId, parts }) }) as Promise<AdiloUploadResult>,

  deleteFile: (fileId: string) => authedFetch(`/adilo/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),

  getFile: (fileId: string) => authedFetch(`/adilo/files/${encodeURIComponent(fileId)}`) as Promise<{ fileId: string; details: any; embedUrl: string | null }>,

  getLessonVideo: (lessonId: string) => authedFetch(`/lessons/${encodeURIComponent(lessonId)}/video`) as Promise<LessonVideoAccess>,

  reportProgress: async (
    lessonId: string,
    body: { position: number; watchedSeconds: number; duration: number; event: string },
    keepalive = false
  ) => {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/lessons/${encodeURIComponent(lessonId)}/video-progress`, {
      method: 'POST',
      keepalive,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await readJson(res).catch(() => ({} as any));
    if (!res.ok) throw new Error(data.error || 'Could not save progress');
    return data as { position: number; watchedSeconds: number; duration: number; isCompleted: boolean; justCompleted: boolean };
  },
};

/* ============================================================================
 * Admin — CSV bulk lesson importer (rows are re-validated on the server)
 * ========================================================================== */
export interface LessonImportRowInput { title: string; embed: string }
export interface LessonImportCheckedRow {
  index: number;
  title: string;
  url: string | null;
  status: 'valid' | 'invalid' | 'duplicate';
  error: string | null;
  existingLessonId?: string | null;
}
export interface LessonImportResult {
  course: { id: string; title: string };
  section: { id: string; title: string; created: boolean };
  total: number;
  created: number;
  skipped: number;
  failed: number;
  results: { index: number; title: string; status: 'created' | 'skipped' | 'failed'; lessonId: string | null; error: string | null }[];
}

export const lessonImportService = {
  check: (courseId: string, sectionId: string | null, rows: LessonImportRowInput[]) =>
    authedFetch('/admin/lessons/bulk-import/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, sectionId, rows }),
    }) as Promise<{ rows: LessonImportCheckedRow[] }>,
  run: (body: { courseId: string; sectionId?: string | null; newSectionTitle?: string; rows: LessonImportRowInput[] }) =>
    authedFetch('/admin/lessons/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as Promise<LessonImportResult>,
};
