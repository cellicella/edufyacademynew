import React from 'react';

/** Shared building blocks for admin console pages. */
export const AdminPageHeader: React.FC<{ eyebrow: string; title: string; description?: string; actions?: React.ReactNode }> = ({
  eyebrow,
  title,
  description,
  actions,
}) => (
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
    <div>
      <span className="ed-eyebrow">{eyebrow}</span>
      <h1 className="ed-display mt-3 text-[2rem] sm:text-[2.5rem] leading-tight">{title}</h1>
      {description && <p className="mt-2 text-[17px] text-[#64748B] max-w-2xl">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string; icon?: React.ElementType; tone?: 'blue' | 'purple' | 'green' | 'ink' }> = ({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'blue',
}) => {
  const tones = {
    blue: 'bg-[#E8EFFB] text-[#004AAD]',
    purple: 'bg-[#F1EAFE] text-[#5E17EB]',
    green: 'bg-emerald-50 text-emerald-700',
    ink: 'bg-[#F1F5F9] text-[#111827]',
  };
  return (
    <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[15px] text-[#64748B]">{label}</span>
        {Icon && (
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
            <Icon className="w-5 h-5" />
          </span>
        )}
      </div>
      <div className="mt-3 font-display text-[28px] font-extrabold tracking-tight text-[#111827] tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[14px] text-[#64748B]">{hint}</div>}
    </div>
  );
};

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const EmptyState: React.FC<{ title: string; body?: string }> = ({ title, body }) => (
  <div className="py-14 text-center">
    <div className="font-display text-[20px] font-bold text-[#111827]">{title}</div>
    {body && <div className="mt-1 text-[16px] text-[#64748B]">{body}</div>}
  </div>
);

export const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-[15px] text-rose-800">
    {message}
    {/does not exist|function|schema cache/i.test(message) && (
      <div className="mt-1 text-rose-700">The admin database functions are missing — apply migration 20261107000002 in Supabase.</div>
    )}
  </div>
);

export const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="flex items-center gap-2">
    <div className="h-2 flex-1 rounded-full bg-[#E2E8F0] overflow-hidden">
      <div className="h-full rounded-full bg-[#004AAD]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
    <span className="text-[14px] tabular-nums text-[#334155] w-10 text-right">{Math.round(value)}%</span>
  </div>
);
