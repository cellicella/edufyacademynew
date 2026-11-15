import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { PaymentRecord } from '@/lib/types';

export interface CreateOrderResponse {
  free?: boolean;
  courseIds?: string[];
  orderId?: string;
  amount?: number; // paise
  currency?: string;
  keyId?: string;
  courseTitle?: string;
  user?: { name: string; email: string };
}

/** Quick reachability check of the Express server (existing public /api/health endpoint). */
export const checkServer = () => api<{ status: string }>('/health', { auth: false, timeoutMs: 7000 });

/** Existing endpoint — price is always read from the database on the server. */
export type PurchaseTarget = { courseId: string } | { bundleId: string };

export const createOrder = (target: PurchaseTarget) =>
  api<CreateOrderResponse>('/payments/create-order', { body: target, timeoutMs: config.timeouts.payment });

/** Existing endpoint — verifies the Razorpay signature server-side, then grants enrollment. */
export const verifyPayment = (p: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
  api<{ success: boolean; message: string; courseIds: string[] }>('/payments/verify-payment', { body: p, timeoutMs: config.timeouts.payment });

export async function fetchPaymentHistory(): Promise<PaymentRecord[]> {
  const { payments } = await api<{ payments: any[] }>('/payments/history');
  return (payments || []).map((p) => ({
    id: p.id,
    courseId: p.course_id,
    courseTitle: p.notes?.courseTitle || p.courses?.title || 'Edufy course',
    thumbnail: p.courses?.thumbnail_url || null,
    amount: Number(p.amount) || 0,
    currency: p.currency || 'INR',
    status: p.status,
    orderId: p.razorpay_order_id,
    paymentId: p.razorpay_payment_id || null,
    createdAt: p.created_at,
  }));
}
