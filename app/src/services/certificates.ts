import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Certificate, mapCertificate } from '@/logic/certificates';

/** The student's own certificates (same table the website uses). */
export async function fetchMyCertificates(userId: string, signal?: AbortSignal): Promise<Certificate[]> {
  let q = supabase.from('certificates').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapCertificate);
}

/**
 * Existing endpoint. The server checks enrollment + that every lesson is completed, and returns
 * the existing certificate instead of issuing a second one.
 */
export async function claimCertificate(courseId: string): Promise<{ certificate: Certificate; alreadyIssued: boolean }> {
  const r = await api<{ success: boolean; certificate: any; alreadyIssued?: boolean }>('/certificates/claim', { body: { courseId } });
  return { certificate: mapCertificate(r.certificate), alreadyIssued: !!r.alreadyIssued };
}

/** Existing public endpoint. */
export async function verifyCertificate(code: string): Promise<Certificate | null> {
  try {
    const r = await api<{ valid: boolean; certificate: any }>(`/certificates/verify/${encodeURIComponent(code)}`, { auth: false });
    return r.valid && r.certificate ? mapCertificate(r.certificate) : null;
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}
