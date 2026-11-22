export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  headline?: string;
  bio?: string;
  enrolledCourseIds: string[];
  wishlistCourseIds: string[];
  completedCourseIds: string[];
}

export type CourseLevel = 'All Levels' | 'Beginner' | 'Intermediate' | 'Advanced';

export interface LessonResource {
  id: string;
  name: string;
  size: string;
  /** Public URL (optional) */
  downloadUrl?: string;
  /** Path inside the private 'course-materials' bucket — served via signed URL */
  storagePath?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  passingScorePercent: number;
  questions: QuizQuestion[];
}

export type CourseStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

export interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  type: 'video' | 'quiz' | 'article';
  videoUrl?: string;
  articleContent?: string;
  contentText?: string;
  storageAssetPath?: string;
  quizId?: string;
  isFreePreview?: boolean;
  resources?: LessonResource[];
  quiz?: Quiz;
  /** Adilo-hosted video (set by the server after a verified upload) */
  adiloFileId?: string | null;
  adiloEmbedUrl?: string | null;
  videoTitle?: string | null;
  videoDuration?: number | null;
  videoStatus?: string | null;
}

export interface CourseSection {
  id: string;
  title: string;
  /** Short overview shown under the section title (optional). */
  description?: string;
  order: number;
  lessons: Lesson[];
}

export interface CourseReview {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number;
  date: string;
  comment: string;
}

export interface Instructor {
  id: string;
  name: string;
  avatar: string;
  title: string;
  company: string;
  bio: string;
  totalStudents: number;
  rating: number;
  coursesCount: number;
  socials?: {
    website?: string;
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  instructor: Instructor;
  category: string;
  categorySlug: string;
  level: CourseLevel;
  price: number;
  originalPrice: number;
  isFree?: boolean;
  rating: number;
  reviewCount: number;
  enrolledCount: number;
  durationHours: number;
  totalLessons: number;
  thumbnail: string;
  previewVideoUrl?: string;
  learningOutcomes: string[];
  requirements: string[];
  targetAudience: string[];
  curriculum: CourseSection[];
  reviews: CourseReview[];
  bestseller?: boolean;
  trending?: boolean;
  featured?: boolean;
  newlyAdded?: boolean;
  lastUpdated: string;
  language: string;
  certificateOffered: boolean;
  isPublished?: boolean;
  status?: CourseStatus;
  /** Search-result title and description (optional; generated from the course when empty). */
  seoTitle?: string;
  seoDescription?: string;
  instructorId?: string;
}

export interface Certificate {
  id: string;
  certificateCode: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  issueDate: string;
  gradeScore: number;
  verificationHash: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: {
    name: string;
    avatar: string;
    role: string;
  };
  date: string;
  readTime: string;
  category: string;
  tags: string[];
}

export interface Bundle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  thumbnail: string;
  price: number;
  isPublished: boolean;
  courses: Course[];
  /** Sum of the individual course prices (for "you save" display) */
  coursesValue: number;
}
