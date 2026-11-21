import type { Instructor } from '../types';

/**
 * Edufy Academy's lead instructor, shown on course pages whose instructor is the platform's administrator
 * account (the courses published by Edufy itself). Only details supplied by Edufy are listed here — add a
 * verified biography, qualifications or experience to these fields when available; empty fields are hidden.
 */
export const LEAD_INSTRUCTOR = {
  name: 'Bhavna Nimbalkar',
  designation: 'Lead Instructor',
  organisation: 'Edufy Academy',
  /** Square photo for small avatars (96 px and 192 px for high-density screens). */
  avatar: '/instructors/bhavna-nimbalkar-96.webp',
  avatar2x: '/instructors/bhavna-nimbalkar-192.webp',
  /** Portrait for the instructor section (480 × 600, WebP with JPEG fallback). */
  portraitWebp: '/instructors/bhavna-nimbalkar-480x600.webp',
  portraitJpg: '/instructors/bhavna-nimbalkar-480x600.jpg',
  bio: '',
  qualifications: [] as string[],
  experience: '',
  expertise: [] as string[],
};

/** True for the administrator account that owns Edufy's own courses (not a real instructor profile). */
export function isPlatformAccount(instructor: Pick<Instructor, 'name' | 'title'> | null | undefined): boolean {
  if (!instructor) return false;
  return /\badministrator\b/i.test(instructor.title || '') || /^edufy\s+admin(istrator)?$/i.test((instructor.name || '').trim());
}

export interface DisplayInstructor {
  name: string;
  title: string;
  avatar: string;
  /** Lead instructor (Edufy's own courses) — the profile statistics of the admin account are not shown. */
  isLead: boolean;
}

/** The instructor to show to visitors for a course. */
export function displayInstructor(instructor: Instructor): DisplayInstructor {
  if (isPlatformAccount(instructor)) {
    return { name: LEAD_INSTRUCTOR.name, title: LEAD_INSTRUCTOR.designation, avatar: LEAD_INSTRUCTOR.avatar2x, isLead: true };
  }
  return { name: instructor.name, title: instructor.title, avatar: instructor.avatar, isLead: false };
}
