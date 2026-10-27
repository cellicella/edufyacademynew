import React from 'react';
import { Link } from 'react-router-dom';
import { EdufyLogo } from '../common/EdufyLogo';
import { ShieldCheck, Award, Globe, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#111827] text-white border-t border-slate-800 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <EdufyLogo variant="white" size="lg" />
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              Edufy Academy is a premier learning marketplace providing verified certifications, project-based engineering curricula, and direct mentorship from industry leaders worldwide.
            </p>
            <div className="flex items-center gap-4 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#5271FF]" />
                <span>Verified Credentials</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#5E17EB]" />
                <span>Accredited Curriculum</span>
              </div>
            </div>
          </div>

          {/* Quick Links: Marketplace */}
          <div>
            <h4 className="font-display text-sm font-semibold text-white tracking-wider uppercase mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>
                <Link to="/courses" className="hover:text-white transition-colors">
                  All Courses
                </Link>
              </li>
              <li>
                <Link to="/courses?category=web-development" className="hover:text-white transition-colors">
                  Web Development
                </Link>
              </li>
              <li>
                <Link to="/courses?category=ai-data-science" className="hover:text-white transition-colors">
                  Artificial Intelligence
                </Link>
              </li>
              <li>
                <Link to="/courses?category=ui-ux-design" className="hover:text-white transition-colors">
                  UI/UX Product Design
                </Link>
              </li>
              <li>
                <Link to="/categories" className="hover:text-white transition-colors">
                  All Categories
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links: Community & Teaching */}
          <div>
            <h4 className="font-display text-sm font-semibold text-white tracking-wider uppercase mb-4">
              Academy
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>
                <Link to="/instructors" className="hover:text-white transition-colors">
                  Instructors Directory
                </Link>
              </li>
              <li>
                <Link to="/become-instructor" className="hover:text-white transition-colors text-[#5271FF] font-semibold">
                  Teach on Edufy (Become Instructor)
                </Link>
              </li>
              <li>
                <Link to="/verify-certificate" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>Verify Certificate</span>
                  <span className="text-[10px] text-blue-400 font-mono">NEW</span>
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Edufy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div>
            <h4 className="font-display text-sm font-semibold text-white tracking-wider uppercase mb-4">
              Trust & Legal
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>
                <Link to="/faq" className="hover:text-white transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/refund" className="hover:text-white transition-colors">
                  30-Day Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} Edufy Academy Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              <span>English (US) · USD ($)</span>
            </span>
            <span className="text-slate-600">|</span>
            <span>Built with precision for modern learners</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
