export type LessonType = 'video' | 'article' | 'quiz';

export interface Lesson {
  id: string;
  sectionId: string;
  title: string;
  durationMinutes: number;
  type: LessonType;
  order: number;
  isFreePreview: boolean;
  /** true when RLS returned the lesson's content (enrolled learner or free preview) */
  accessible: boolean;
  videoUrl: string | null;
  contentText: string | null;
  adiloFileId: string | null;
  adiloEmbedUrl: string | null;
  quizId: string | null;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface Instructor {
  id: string;
  name: string;
  headline: string | null;
  avatar: string | null;
  bio: string | null;
}

export interface Course {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string;
  categorySlug: string;
  level: string;
  language: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewCount: number;
  enrolledCount: number;
  durationHours: number;
  totalLessons: number;
  thumbnail: string | null;
  previewVideoUrl: string | null;
  featured: boolean;
  bestseller: boolean;
  trending: boolean;
  createdAt: string;
  instructor: Instructor;
  learningOutcomes: string[];
  requirements: string[];
  targetAudience: string[];
}

export interface CourseWithCurriculum extends Course {
  sections: Section[];
}

export interface Category {
  slug: string;
  name: string;
  count: number;
  description?: string | null;
  imageUrl?: string | null;
  position?: number;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  role: 'student' | 'instructor' | 'admin';
  createdAt: string | null;
}

export interface Enrollment {
  courseId: string;
  enrolledAt: string;
  completedAt: string | null;
  status: string;
  /** Set when the course was granted by a bundle purchase */
  bundleId: string | null;
}

export type { CourseProgress } from '../logic/progress';

export interface PaymentRecord {
  id: string;
  courseId: string | null;
  courseTitle: string;
  thumbnail: string | null;
  amount: number;
  currency: string;
  status: string;
  orderId: string;
  paymentId: string | null;
  createdAt: string;
}
