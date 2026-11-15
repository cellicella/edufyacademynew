import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { EdufyLogo } from '../components/common/EdufyLogo';
import { ToastContainer } from '../components/common/ToastContainer';
import { ApiStatusBanner } from '../components/admin/ApiStatusBanner';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  Users,
  BookCheck,
  TrendingUp,
  Sliders,
  LogOut,
  Compass,
  Menu,
  X,
  PlusCircle,
  IndianRupee,
  GraduationCap,
  UsersRound,
  Layers,
  FileSpreadsheet,
  BellRing,
  GalleryHorizontal,
  Megaphone,
  Tags,
  Newspaper,
  Settings as SettingsIcon,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Overview', href: '/admin', icon: TrendingUp },
    { label: 'Revenue', href: '/admin/revenue', icon: IndianRupee },
    { label: 'Courses', href: '/admin/courses', icon: BookCheck },
    { label: 'Create course', href: '/admin/courses/new', icon: PlusCircle },
    { label: 'Bulk lesson import', href: '/admin/lesson-import', icon: FileSpreadsheet },
    { label: 'Categories', href: '/admin/categories', icon: Tags },
    { label: 'Bundles', href: '/admin/bundles', icon: Layers },
    { label: 'Blog', href: '/admin/blog', icon: Newspaper },
    { label: 'Push notifications', href: '/admin/notifications', icon: BellRing },
    { label: 'Offers', href: '/admin/offers', icon: Megaphone },
    { label: 'Banners', href: '/admin/settings/website-banners', icon: GalleryHorizontal },
    { label: 'Instructors', href: '/admin/instructors', icon: GraduationCap },
    { label: 'Students', href: '/admin/students', icon: UsersRound },
    { label: 'All users', href: '/admin/users', icon: Users },
    { label: 'Reports', href: '/admin/reports', icon: Sliders },
    { label: 'Settings & Configuration', href: '/admin/settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-white text-[#111827] border-r border-[#E2E8F0] shrink-0">
        <div className="p-5 border-b border-[#E2E8F0]">
          <EdufyLogo size="md" />
        </div>

        {/* Admin Badge */}
        <div className="p-4 mx-3 my-3 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[#111827] truncate">{currentUser?.name || 'Platform Admin'}</h4>
            <span className="text-[12px] text-emerald-400 font-semibold block uppercase tracking-wider">Super Administrator</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.href.startsWith('/admin/settings') ? (item.href.includes('banners') ? /banners/.test(location.pathname) : location.pathname.startsWith('/admin/settings') && !/banners/.test(location.pathname)) : location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 h-12 rounded-full text-[15px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#111827] text-white'
                    : 'text-[#475569] hover:text-[#111827] hover:bg-[#F7F9FC]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-[#E2E8F0]">
            <Link
              to="/courses"
              className="flex items-center gap-3 px-4 h-12 rounded-full text-[15px] font-medium text-[#475569] hover:text-[#111827] hover:bg-[#F7F9FC] transition-colors"
            >
              <Compass className="w-4 h-4" />
              <span>Public Marketplace</span>
            </Link>
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#E2E8F0] space-y-2">
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden bg-white text-[#111827] p-4 flex items-center justify-between border-b border-[#E2E8F0]">
        <EdufyLogo size="sm" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#111827]"
            aria-label="Toggle admin menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white text-[#111827] p-4 space-y-2 border-b border-[#E2E8F0]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#111827] rounded-lg hover:bg-[#F7F9FC]"
            >
              <item.icon className="w-4 h-4 text-emerald-400" />
              <span>{item.label}</span>
            </Link>
          ))}
          <Link
            to="/courses"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-400"
          >
            <Compass className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </Link>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="hidden md:flex items-center justify-between h-[72px] px-10 bg-white/90 backdrop-blur border-b border-[#E2E8F0]">
          <div>
            <h1 className="text-sm font-bold text-[#111827]">Platform Administration Console</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">
              Governance & Security Enforcement
            </span>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          <ApiStatusBanner />
          <Outlet />
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};
