import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';
import { isStoredPhone } from '@/logic/phone';

export function mapProfile(row: any, email: string): Profile {
  return {
    id: row.id,
    email: row.email || email,
    fullName: row.full_name || email.split('@')[0],
    avatarUrl: row.avatar_url || null,
    phone: row.phone || null,
    role: row.role || 'student',
    createdAt: row.created_at || null,
  };
}

/** Loads the profile; creates it (as the website does) if the signup trigger has not. */
export async function loadOrCreateProfile(userId: string, email: string, fullName?: string, signupPhone?: unknown): Promise<Profile> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (data) {
    // Mobile number given at app sign-up: copied to the profile once (never overwrites a number already set)
    if (!data.phone && isStoredPhone(signupPhone)) {
      const { error } = await supabase.from('profiles').update({ phone: signupPhone, updated_at: new Date().toISOString() }).eq('id', userId);
      if (!error) data.phone = signupPhone;
    }
    return mapProfile(data, email);
  }
  const row: Record<string, any> = { id: userId, email, full_name: fullName || email.split('@')[0], role: 'student', headline: 'Student at Edufy Academy', bio: '' };
  if (isStoredPhone(signupPhone)) row.phone = signupPhone;
  const { data: created, error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' }).select().maybeSingle();
  if (error) throw new Error(error.message);
  return mapProfile(created || row, email);
}

/** RLS: users can update only their own profile; role changes are blocked by a DB trigger. */
export async function updateProfile(userId: string, fields: { fullName?: string; phone?: string | null; avatarUrl?: string | null }) {
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (fields.fullName !== undefined) patch.full_name = fields.fullName.trim();
  if (fields.phone !== undefined) patch.phone = fields.phone ? fields.phone.trim() : null;
  if (fields.avatarUrl !== undefined) patch.avatar_url = fields.avatarUrl;
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error(error.message);
  if (fields.fullName) await supabase.auth.updateUser({ data: { full_name: fields.fullName.trim() } });
}

/** Uploads to the existing public "avatars" bucket (policy: users write only their own folder). */
export async function uploadAvatar(userId: string, uri: string, mimeType = 'image/jpeg'): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const bytes = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, { contentType: mimeType, upsert: true });
  if (error) throw new Error(error.message);
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
