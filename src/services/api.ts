import { Course, Instructor, BlogPost, Certificate, Quiz } from '../types';
import { gradeQuizSubmission, QuizEvaluationResult } from '../utils/courseUtils';
import { supabase, isSupabaseConfigured, getAuthToken } from '../lib/supabase';

export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  '/api';

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
    targetAudience: ['Learners', 'Software Engineers', 'Career Changers'],
    certificateOffered: true,
    curriculum: (item.course_sections || []).map((sec: any) => ({
      id: sec.id,
      title: sec.title,
      order: sec.section_order || 1,
      lessons: (sec.lessons || []).map((l: any) => ({
        id: l.id,
        title: l.title,
        durationMinutes: l.duration_minutes || 10,
        type: l.type || 'video',
        videoUrl: l.video_url || '',
        contentText: l.content_text || '',
        storageAssetPath: l.storage_asset_path || '',
        isFreePreview: !!l.is_free_preview,
        quizId: l.quiz_id || undefined,
      })),
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

        let result = data.map(mapSupabaseCourse);

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
          .or(`id.eq.${id},slug.eq.${id}`)
          .maybeSingle();

        if (error) {
          console.warn('[Edufy API] Course by id query error:', error);
          return null;
        }

        if (data) {
          return mapSupabaseCourse(data);
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

    const data = await res.json();
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

    const data = await res.json();
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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update publication status.');
    }
    return data;
  },

  /**
   * Retrieve Admin All Courses (drafts, pending, published)
   */
  async getAdminCourses(): Promise<Course[]> {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/courses/admin/all`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to retrieve admin course catalog.');
    }
    return (data.courses || []).map(mapSupabaseCourse);
  },

  /**
   * Retrieve Courses Authored by Current User
   */
  async getInstructorCourses(): Promise<Course[]> {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/courses/instructor/mine`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to retrieve instructor courses.');
    }
    return (data.courses || []).map(mapSupabaseCourse);
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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload media file.');
    }
    return data;
  },

  /**
   * Apply to become an instructor
   */
  async applyToBecomeInstructor(payload: { headline?: string; bio?: string }): Promise<{ success: boolean; message: string; profile: any }> {
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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit instructor application.');
    }
    return data;
  },

  async getCategories() {
    const baseCategories = [
      {
        id: 'cat-1',
        name: 'Web Development',
        slug: 'web-development',
        icon: 'Code2',
        description: 'React, TypeScript, Node.js, Next.js, GraphQL, and modern web architectures.',
      },
      {
        id: 'cat-2',
        name: 'Artificial Intelligence',
        slug: 'ai-data-science',
        icon: 'Cpu',
        description: 'Machine Learning, PyTorch, LLMs, Computer Vision, and Neural Networks.',
      },
      {
        id: 'cat-3',
        name: 'UI/UX Design',
        slug: 'ui-ux-design',
        icon: 'Palette',
        description: 'Figma, Design Systems, Usability, Micro-interactions, and Design Research.',
      },
      {
        id: 'cat-4',
        name: 'Cloud & DevOps',
        slug: 'cloud-devops',
        icon: 'Cloud',
        description: 'AWS, Kubernetes, Terraform, Docker, CI/CD, and Site Reliability Engineering.',
      },
      {
        id: 'cat-5',
        name: 'Business & Leadership',
        slug: 'business-leadership',
        icon: 'Briefcase',
        description: 'Product Management, Executive Strategy, Agile Operations, and Startup Scaling.',
      },
      {
        id: 'cat-6',
        name: 'Cybersecurity',
        slug: 'cybersecurity',
        icon: 'ShieldCheck',
        description: 'Penetration testing, cryptography, network defense, and DevSecOps.',
      },
    ];

    if (isSupabaseConfigured) {
      try {
        const { data: courses } = await supabase
          .from('courses')
          .select('category_slug')
          .eq('is_published', true);

        if (courses) {
          const counts: Record<string, number> = {};
          courses.forEach((c) => {
            const s = c.category_slug;
            counts[s] = (counts[s] || 0) + 1;
          });

          return baseCategories.map((cat) => ({
            ...cat,
            courseCount: counts[cat.slug] || 0,
          }));
        }
      } catch (err) {
        console.warn('[Edufy API] Error fetching category counts:', err);
      }
    }

    return baseCategories.map((c) => ({ ...c, courseCount: 0 }));
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
  async getAllPosts(): Promise<BlogPost[]> {
    return [];
  },

  async getPostBySlug(_slug: string): Promise<BlogPost | null> {
    return null;
  },
};

export const certificateService = {
  /**
   * Verify certificate credential publicly through backend API
   */
  async verifyCertificate(code: string): Promise<{ valid: boolean; certificate: Certificate | null; error?: string }> {
    try {
      const res = await fetch(`/api/certificates/verify/${encodeURIComponent(code)}`);
      const data = await res.json();
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

      const data = await res.json();
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
        const data = await res.json();
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
        const data = await res.json();
        return data.signedUrl || null;
      }
      return null;
    } catch (err) {
      console.warn('[Storage API] signed url error:', err);
      return null;
    }
  },
};
