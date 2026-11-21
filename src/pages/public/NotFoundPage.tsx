import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../../lib/seo';

/** Unknown addresses: shown with HTTP 404 by the web server (.htaccess → 404.html) and marked noindex. */
export const NotFoundPage: React.FC = () => {
  useSeo({ title: 'Page not found | Edufy Academy', robots: 'noindex, follow', canonicalPath: null, description: 'The page you are looking for could not be found on Edufy Academy.', ld: [] });
  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <h1 className="font-display text-4xl font-extrabold text-[#111827]">Page not found</h1>
      <p className="text-sm text-[#64748B]">The page you are looking for could not be located. It may have moved or no longer exists.</p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link to="/" className="px-4 py-2 text-sm font-semibold text-white bg-[#004AAD] rounded-full">Go to Edufy Academy home</Link>
        <Link to="/courses" className="px-4 py-2 text-sm font-semibold text-[#004AAD] bg-white border border-[#CBD5E1] rounded-full">Browse all courses</Link>
      </div>
    </div>
  );
};
