import React, { createContext, useContext, useState, useEffect } from 'react';
import { calculateCourseProgress } from '../utils/courseUtils';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface CourseProgressState {
  // Map of courseId -> array of completed lesson IDs
  completedLessons: Record<string, string[]>;
  // Map of courseId -> current active lesson ID
  activeLessons: Record<string, string>;
  // Student notes: courseId -> array of { id, lessonId, text, timestamp }
  studentNotes: Record<string, Array<{ id: string; lessonId: string; text: string; createdAt: string }>>;
}

interface CourseProgressContextType {
  completedLessons: Record<string, string[]>;
  activeLessons: Record<string, string>;
  isLessonCompleted: (courseId: string, lessonId: string) => boolean;
  toggleLessonComplete: (courseId: string, lessonId: string) => Promise<void>;
  markLessonComplete: (courseId: string, lessonId: string) => Promise<void>;
  setActiveLesson: (courseId: string, lessonId: string) => void;
  getActiveLessonId: (courseId: string, fallbackLessonId: string) => string;
  getCourseProgressPercent: (courseId: string, totalLessons: number) => number;
  addNote: (courseId: string, lessonId: string, text: string) => void;
  getNotes: (courseId: string) => Array<{ id: string; lessonId: string; text: string; createdAt: string }>;
}

const CourseProgressContext = createContext<CourseProgressContextType | undefined>(undefined);

export const CourseProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();

  const [state, setState] = useState<CourseProgressState>(() => {
    const saved = localStorage.getItem('edufy_progress');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback default
      }
    }
    return {
      completedLessons: {},
      activeLessons: {},
      studentNotes: {},
    };
  });

  // Load progress from Supabase if user is logged in
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !isSupabaseConfigured) return;

    const loadRemoteProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('lesson_progress')
          .select('course_id, lesson_id, is_completed')
          .eq('user_id', currentUser.id)
          .eq('is_completed', true);

        if (!error && data) {
          const remoteMap: Record<string, string[]> = {};
          data.forEach((row) => {
            if (!remoteMap[row.course_id]) {
              remoteMap[row.course_id] = [];
            }
            if (!remoteMap[row.course_id].includes(row.lesson_id)) {
              remoteMap[row.course_id].push(row.lesson_id);
            }
          });

          setState((prev) => ({
            ...prev,
            completedLessons: {
              ...prev.completedLessons,
              ...remoteMap,
            },
          }));
        }
      } catch (err) {
        console.warn('[Progress] Error loading remote progress:', err);
      }
    };

    loadRemoteProgress();
  }, [currentUser?.id, isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('edufy_progress', JSON.stringify(state));
  }, [state]);

  const isLessonCompleted = (courseId: string, lessonId: string): boolean => {
    const lessons = state.completedLessons[courseId] || [];
    return lessons.includes(lessonId);
  };

  const toggleLessonComplete = async (courseId: string, lessonId: string) => {
    const current = state.completedLessons[courseId] || [];
    const isAlreadyDone = current.includes(lessonId);
    const updated = isAlreadyDone ? current.filter((id) => id !== lessonId) : [...current, lessonId];

    setState((prev) => ({
      ...prev,
      completedLessons: {
        ...prev.completedLessons,
        [courseId]: updated,
      },
    }));

    if (isSupabaseConfigured && currentUser) {
      try {
        await supabase.from('lesson_progress').upsert(
          {
            user_id: currentUser.id,
            course_id: courseId,
            lesson_id: lessonId,
            is_completed: !isAlreadyDone,
            completed_at: !isAlreadyDone ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,lesson_id' }
        );
      } catch (err) {
        console.warn('[Progress] Supabase sync failed:', err);
      }
    }
  };

  const markLessonComplete = async (courseId: string, lessonId: string) => {
    const current = state.completedLessons[courseId] || [];
    if (current.includes(lessonId)) return;

    setState((prev) => ({
      ...prev,
      completedLessons: {
        ...prev.completedLessons,
        [courseId]: [...current, lessonId],
      },
    }));

    if (isSupabaseConfigured && currentUser) {
      try {
        await supabase.from('lesson_progress').upsert(
          {
            user_id: currentUser.id,
            course_id: courseId,
            lesson_id: lessonId,
            is_completed: true,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,lesson_id' }
        );
      } catch (err) {
        console.warn('[Progress] Supabase sync failed:', err);
      }
    }
  };

  const setActiveLesson = (courseId: string, lessonId: string) => {
    setState((prev) => ({
      ...prev,
      activeLessons: {
        ...prev.activeLessons,
        [courseId]: lessonId,
      },
    }));
  };

  const getActiveLessonId = (courseId: string, fallbackLessonId: string): string => {
    return state.activeLessons[courseId] || fallbackLessonId;
  };

  const getCourseProgressPercent = (courseId: string, totalLessons: number): number => {
    const completed = state.completedLessons[courseId] || [];
    return calculateCourseProgress(totalLessons, completed);
  };

  const addNote = (courseId: string, lessonId: string, text: string) => {
    if (!text.trim()) return;
    const newNote = {
      id: `note-${Date.now()}`,
      lessonId,
      text: text.trim(),
      createdAt: 'Just now',
    };
    setState((prev) => ({
      ...prev,
      studentNotes: {
        ...prev.studentNotes,
        [courseId]: [newNote, ...(prev.studentNotes[courseId] || [])],
      },
    }));
  };

  const getNotes = (courseId: string) => {
    return state.studentNotes[courseId] || [];
  };

  return (
    <CourseProgressContext.Provider
      value={{
        completedLessons: state.completedLessons,
        activeLessons: state.activeLessons,
        isLessonCompleted,
        toggleLessonComplete,
        markLessonComplete,
        setActiveLesson,
        getActiveLessonId,
        getCourseProgressPercent,
        addNote,
        getNotes,
      }}
    >
      {children}
    </CourseProgressContext.Provider>
  );
};

export const useCourseProgress = () => {
  const context = useContext(CourseProgressContext);
  if (!context) {
    throw new Error('useCourseProgress must be used within a CourseProgressProvider');
  }
  return context;
};
