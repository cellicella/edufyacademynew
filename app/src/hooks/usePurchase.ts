import { useEffect, useRef, useState } from 'react';
import { BackHandler, NativeModules } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { qk, useEnrollments } from '@/hooks/queries';
import { checkServer, createOrder, PurchaseTarget, verifyPayment } from '@/services/payments';
import { config } from '@/lib/config';
import { colors } from '@/theme';
import { friendlyMessage } from '@/logic/apiErrors';
import { isFinalVerifyError, isValidRazorpaySuccess, parseRazorpayError, RazorpaySuccess } from '@/logic/payments';

export type PurchasePhase = 'review' | 'creating' | 'paying' | 'verifying' | 'success' | 'failed' | 'verify_failed';

/** Native Razorpay SDK when present in the build (development / production build, not Expo Go). */
function getNativeRazorpay(): { open: (o: any) => Promise<any> } | null {
  if (!NativeModules.RNRazorpayCheckout) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-razorpay');
    return mod?.default || mod;
  } catch (e: any) {
    console.warn('[checkout] native Razorpay unavailable, using web checkout:', e?.message || e);
    return null;
  }
}

/**
 * Razorpay purchase flow for a course OR a bundle, using the existing server endpoints:
 * create-order (price from the database) → Razorpay → verify-payment (HMAC on the server, then
 * enrollment in every course of the order). The app never grants access by itself.
 */
export function usePurchase(target: PurchaseTarget | null, display: { title: string; image?: string | null }, alreadyOwned: (courseIds: string[]) => boolean) {
  const qc = useQueryClient();
  const { session, profile } = useAuth();
  const enrollments = useEnrollments();
  const [phase, setPhase] = useState<PurchasePhase>('review');
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [webOptions, setWebOptions] = useState<Record<string, any> | null>(null);
  // Razorpay result kept so a failed *verification* can be retried without paying again
  const [pendingVerification, setPendingVerification] = useState<RazorpaySuccess | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Android back button: don't leave while the payment is being verified
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => phase === 'verifying');
    return () => sub.remove();
  }, [phase]);

  const refreshAccess = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.enrollments(session?.user.id) }),
      qc.invalidateQueries({ queryKey: ['course'] }),
      qc.invalidateQueries({ queryKey: ['progress'] }),
      qc.invalidateQueries({ queryKey: qk.payments(session?.user.id) }),
      qc.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
  };

  const verify = async (r: RazorpaySuccess) => {
    setWebOptions(null);
    if (!isValidRazorpaySuccess(r)) {
      setError('Razorpay did not return a complete payment confirmation. If money was deducted it will be verified automatically — refresh My Learning in a few minutes.');
      setPhase('failed');
      return;
    }
    setPendingVerification(r);
    setPhase('verifying');
    // verify-payment is idempotent on the server, so transient failures are retried; 4xx are final
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await verifyPayment(r);
        setPendingVerification(null);
        await refreshAccess();
        if (mounted.current) setPhase('success');
        return;
      } catch (e: any) {
        lastErr = e;
        if (typeof e?.status === 'number' && isFinalVerifyError(e.status)) break;
        await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      }
    }
    if (!mounted.current) return;
    const final = typeof lastErr?.status === 'number' && isFinalVerifyError(lastErr.status);
    if (final) setPendingVerification(null);
    setError(
      final
        ? `${lastErr?.message || 'Payment verification failed.'} If money was deducted, contact support with payment ID ${r.razorpay_payment_id}.`
        : `Your payment went through but we couldn’t confirm it yet (${lastErr?.message || 'network error'}). Don’t pay again — tap “Retry verification”. Payment ID: ${r.razorpay_payment_id}`
    );
    setPhase(final ? 'failed' : 'verify_failed');
  };

  const fail = (message: string, cancelled: boolean) => {
    setWebOptions(null);
    setError(cancelled ? 'Payment was cancelled. You have not been charged.' : message);
    setPhase('failed');
  };

  const pay = async () => {
    if (!target || inFlight.current) return; // guard against double taps
    inFlight.current = true;
    setError(null);
    setPhase('creating');
    try {
      // A previous attempt may have been completed by the Razorpay webhook — re-check (bounded)
      setStep('Checking your enrollment…');
      const fresh = await Promise.race([enrollments.refetch(), new Promise<null>((res) => setTimeout(() => res(null), 8000))]);
      if (fresh && fresh.data && alreadyOwned(fresh.data.map((e) => e.courseId))) {
        await refreshAccess();
        setPhase('success');
        return;
      }
      setStep('Connecting to Edufy…');
      try {
        await checkServer();
      } catch {
        throw new Error(
          `Can't reach the Edufy server at ${config.apiUrl}. Make sure the server is running (npm run dev) and that this phone can open ${config.apiUrl}/api/health in Chrome. ` +
            'On a real phone, EXPO_PUBLIC_API_URL must be your PC’s Wi-Fi IP address (not 10.0.2.2 or localhost).'
        );
      }
      setStep('Creating your order…');
      const order = await createOrder(target); // never retried automatically
      if (order.free) {
        await refreshAccess();
        setPhase('success');
        return;
      }
      if (!order.orderId || !order.keyId) throw new Error('Could not start the payment. Please try again.');
      const options = {
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Edufy Academy',
        description: order.courseTitle || display.title,
        image: display.image || undefined,
        prefill: { name: profile?.fullName || order.user?.name || '', email: profile?.email || order.user?.email || '', contact: profile?.phone || '' },
        notes: 'bundleId' in target ? { bundleId: target.bundleId } : { courseId: target.courseId },
        theme: { color: colors.primary },
      };
      setPhase('paying');
      setStep('Opening Razorpay…');
      const native = getNativeRazorpay();
      if (native) {
        let result: any;
        try {
          result = await native.open(options);
        } catch (e: any) {
          const parsed = parseRazorpayError(e);
          fail(parsed.message, parsed.cancelled);
          return;
        }
        await verify(result);
      } else {
        setWebOptions(options);
      }
    } catch (e: any) {
      if (/already enrolled/i.test(e?.message || '')) {
        await refreshAccess();
        setPhase('success');
        return;
      }
      const msg = String(e?.message || '');
      setError(/^Can.t reach/.test(msg) ? msg : friendlyMessage(e, 'Could not start the payment.'));
      setPhase('failed');
    } finally {
      inFlight.current = false;
      setStep('');
    }
  };

  return {
    phase, step, error, webOptions, pendingVerification,
    busy: phase === 'creating' || phase === 'paying' || phase === 'verifying',
    pay, verify, fail,
    retryVerification: () => pendingVerification && verify(pendingVerification),
  };
}
