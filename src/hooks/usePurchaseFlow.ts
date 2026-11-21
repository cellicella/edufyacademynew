import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCartWishlist } from '../context/CartWishlistContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PurchaseKind, RESUME_PARAM, clearIntent, consumeIntent, loginUrl, resumePath, saveIntent } from '../lib/purchaseIntent';

type CourseLike = { id: string; title: string; price: number };

/**
 * Starts a course purchase from any button. Signed-in visitors go straight to the existing enrollment flow
 * (server order → Razorpay checkout → server verification, or free enrollment). Guests are sent to the existing
 * sign-in page and come back to this course to continue — no "please sign in" alert.
 */
export function useStartCoursePurchase() {
  const { currentUser } = useAuth();
  const { initiateCourseEnrollment } = useCartWishlist();
  const navigate = useNavigate();
  return useCallback(
    async (course: CourseLike): Promise<boolean> => {
      if (!currentUser) {
        saveIntent('course', course.id);
        navigate(loginUrl(resumePath('course', course.id)));
        return false;
      }
      clearIntent(); // a purchase started while signed in replaces any earlier unfinished guest intent
      return initiateCourseEnrollment(course);
    },
    [currentUser, initiateCourseEnrollment, navigate]
  );
}

/** Sends a guest to sign in, remembering the bundle or cart purchase. */
export function useGuestRedirect() {
  const navigate = useNavigate();
  return useCallback(
    (kind: Exclude<PurchaseKind, 'course'>, id: string, currentPath?: string) => {
      saveIntent(kind, id);
      navigate(loginUrl(resumePath(kind, id, currentPath)));
    },
    [navigate]
  );
}

async function ownsCourse(userId: string, courseId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data } = await supabase.from('enrollments').select('course_id').eq('user_id', userId).eq('course_id', courseId).eq('status', 'active').limit(1);
    return !!data && data.length > 0;
  } catch {
    return false; // the server rejects duplicate purchases anyway
  }
}

/**
 * After sign-in: if the page was opened with the resume marker AND this browser saved a matching, recent intent,
 * continue the purchase once. The marker is removed from the address immediately, so refreshing or going back
 * never starts another checkout. Guests (sign-in cancelled) and stale or foreign links do nothing.
 */
export function useResumePurchase(kind: PurchaseKind, id: string | null | undefined, run: () => Promise<boolean>, onSuccess?: () => void) {
  const { currentUser, isLoading } = useAuth();
  const { refreshUserData, showToast } = useCartWishlist();
  const [params, setParams] = useSearchParams();
  const handled = useRef(false);
  const [paramKey, paramValue] = RESUME_PARAM[kind];
  const marked = params.get(paramKey) === paramValue;

  const runRef = useRef(run);
  runRef.current = run;
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;

  const strip = () => {
    const next = new URLSearchParams(window.location.search);
    next.delete(paramKey);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (!marked || !id || isLoading || handled.current) return;
    if (!currentUser) {
      // Right after a Google / email-link sign-in the session can arrive a moment later: wait briefly for it,
      // otherwise (a guest, or sign-in cancelled) just drop the marker without starting anything.
      const t = setTimeout(() => {
        if (!handled.current) {
          handled.current = true;
          strip();
        }
      }, 6000);
      return () => clearTimeout(t);
    }
    handled.current = true;
    strip();
    if (!consumeIntent(kind, id)) return;

    (async () => {
      if (kind === 'course' && (await ownsCourse(currentUser.id, id))) {
        await refreshUserData();
        showToast('You already have access to this course.', 'info');
        return;
      }
      const ok = await runRef.current();
      if (ok) successRef.current?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marked, id, isLoading, currentUser?.id]);
}
