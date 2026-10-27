import { Quiz } from '../types';

/**
 * Calculates percentage completion for a course
 */
export function calculateCourseProgress(totalLessons: number, completedLessonIds: string[]): number {
  if (totalLessons <= 0) return 0;
  const count = completedLessonIds.length;
  const percent = Math.round((count / totalLessons) * 100);
  return Math.min(100, Math.max(0, percent));
}

/**
 * Calculates discount percentage
 */
export function calculateDiscountPercent(price: number, originalPrice: number): number {
  if (originalPrice <= 0 || price >= originalPrice) return 0;
  const discount = ((originalPrice - price) / originalPrice) * 100;
  return Math.round(discount);
}

/**
 * Formats duration in hours and minutes
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  const wholeHours = Math.floor(hours);
  const remainingMins = Math.round((hours - wholeHours) * 60);
  if (remainingMins === 0) {
    return `${wholeHours}h`;
  }
  return `${wholeHours}h ${remainingMins}m`;
}

export interface QuizEvaluationResult {
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  questionResults: {
    questionId: string;
    isCorrect: boolean;
    userAnswerIndex: number;
    correctOptionIndex: number;
  }[];
}

/**
 * Evaluates a user's quiz submission
 */
export function gradeQuizSubmission(
  quiz: Quiz,
  selectedAnswers: Record<string, number>
): QuizEvaluationResult {
  const total = quiz.questions.length;
  if (total === 0) {
    return {
      scorePercent: 0,
      correctCount: 0,
      totalQuestions: 0,
      passed: false,
      questionResults: [],
    };
  }

  let correctCount = 0;
  const questionResults = quiz.questions.map((q) => {
    const userIndex = selectedAnswers[q.id] ?? -1;
    const isCorrect = userIndex === q.correctOptionIndex;
    if (isCorrect) correctCount++;
    return {
      questionId: q.id,
      isCorrect,
      userAnswerIndex: userIndex,
      correctOptionIndex: q.correctOptionIndex,
    };
  });

  const scorePercent = Math.round((correctCount / total) * 100);
  const passed = scorePercent >= quiz.passingScorePercent;

  return {
    scorePercent,
    correctCount,
    totalQuestions: total,
    passed,
    questionResults,
  };
}

/**
 * Validates certificate code format: EDU-YYYY-XXXXX (e.g. EDU-2026-98421)
 */
export function validateCertificateCodeFormat(code: string): boolean {
  if (!code) return false;
  const cleaned = code.trim().toUpperCase();
  const regex = /^EDU-\d{4}-[A-Z0-9]{4,6}$/;
  return regex.test(cleaned);
}
