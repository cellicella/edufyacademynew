/** Official Edufy Academy social media profiles (keep in sync with the website's src/config/social.ts). */
export interface SocialProfile {
  id: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'pinterest' | 'reddit';
  label: string;
  url: string;
}

export const SOCIAL_PROFILES: SocialProfile[] = [
  { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/edufyacademy360/' },
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/edufyacademy_learning/' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/edufyacademy360/' },
  { id: 'x', label: 'X (Twitter)', url: 'https://x.com/edufyacademy247' },
  { id: 'pinterest', label: 'Pinterest', url: 'https://in.pinterest.com/elseduacademy/' },
  { id: 'reddit', label: 'Reddit', url: 'https://www.reddit.com/user/edufyAcademy/' },
];
