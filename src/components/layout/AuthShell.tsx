import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { EdufyLogo } from '../common/EdufyLogo';

/**
 * Split-screen shell for authentication pages.
 * Left: editorial photography panel (desktop). Right: the form column.
 */
export const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#F7F9FC] grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    <aside className="hidden lg:flex relative overflow-hidden bg-[#0B1220] text-white">
      <img
        src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&auto=format&fit=crop&q=80"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-60"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/60 to-[#0B1220]/20" />
      <div className="relative flex flex-col justify-between p-12 xl:p-16 w-full">
        <EdufyLogo variant="white" size="md" slot="login" />
        <div className="max-w-lg">
          <h2 className="font-display text-[2.75rem] xl:text-[3.25rem] font-extrabold leading-[1.06] tracking-[-0.035em]">
            Every expert was once a beginner.
          </h2>
          <p className="mt-6 text-[19px] leading-[1.7] text-white/75">
            Pick up where you left off, track your progress and earn certificates that employers can verify.
          </p>
          <div className="mt-10 inline-flex items-center gap-3 h-12 px-5 rounded-full bg-white/10 backdrop-blur border border-white/15 text-[15px]">
            <ShieldCheck className="w-5 h-5 text-[#A5B8FF]" />
            Secure sign-in protected by Supabase Auth
          </div>
        </div>
      </div>
    </aside>

    <main className="flex flex-col">
      <div className="flex items-center justify-between px-6 sm:px-10 h-20">
        <div className="lg:hidden">
          <EdufyLogo size="sm" slot="login" />
        </div>
        <Link to="/" className="ml-auto inline-flex items-center gap-2 text-[15px] font-medium text-[#475569] hover:text-[#004AAD]">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 sm:px-10 pb-16 [&_.edufy-auth-logo]:hidden">{children}</div>
    </main>
  </div>
);
