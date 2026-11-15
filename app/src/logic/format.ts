export const formatPrice = (amount: number, currency = 'INR') =>
  amount <= 0
    ? 'Free'
    : currency === 'INR'
    ? `₹${Math.round(amount).toLocaleString('en-IN')}`
    : `${currency} ${amount.toFixed(2)}`;

export const discountPercent = (price: number, original: number) =>
  original > price && original > 0 ? Math.round(((original - price) / original) * 100) : 0;

export const formatDuration = (hours: number) => {
  if (!hours || hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const formatMinutes = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const timeAgo = (iso: string | null | undefined) => {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return formatDate(iso);
};

export const firstName = (name: string | null | undefined) => (name || '').trim().split(/\s+/)[0] || 'there';

export const initials = (name: string | null | undefined) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
