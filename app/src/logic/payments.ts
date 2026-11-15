/** Pure helpers for the Razorpay checkout flow (no network, no React Native). */
export interface RazorpaySuccess { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }

export function isValidRazorpaySuccess(r: any): r is RazorpaySuccess {
  return !!r && typeof r.razorpay_payment_id === 'string' && r.razorpay_payment_id.startsWith('pay_')
    && typeof r.razorpay_order_id === 'string' && r.razorpay_order_id.length > 0
    && typeof r.razorpay_signature === 'string' && r.razorpay_signature.length > 0;
}

/**
 * Normalises the native SDK's rejection. react-native-razorpay rejects with { code, description }
 * where description may itself be JSON. Code 0 / 2 (and "cancel" text) mean the student closed it.
 */
export function parseRazorpayError(e: any): { cancelled: boolean; message: string } {
  const code = Number(e?.code);
  let message = 'Payment failed. You have not been charged — please try again.';
  let reason = '';
  const raw = e?.description;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.error?.description || message;
      reason = parsed?.error?.reason || '';
    } catch {
      if (raw.trim()) message = raw.trim();
    }
  } else if (raw?.error?.description) {
    message = raw.error.description;
    reason = raw.error.reason || '';
  }
  const cancelled = code === 0 || code === 2 || /cancel/i.test(message) || /cancel/i.test(reason) || reason === 'payment_cancelled';
  return { cancelled, message: cancelled ? 'Payment was cancelled. You have not been charged.' : message };
}

/** Schemes that must be handed to Android/iOS (UPI apps, bank apps) instead of loading in a WebView. */
export function isExternalPaymentUrl(url: string): boolean {
  return /^(upi|intent|tez|phonepe|paytmmp|gpay|bhim|credpay|market|mailto|tel):/i.test(url);
}

/** Error from verify-payment that means retrying with the same payload will never succeed. */
export const isFinalVerifyError = (status: number) => status === 400 || status === 404 || status === 403;
