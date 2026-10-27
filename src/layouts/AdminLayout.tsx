import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { EdufyLogo } from '../components/common/EdufyLogo';
import { RoleSwitcher } from '../components/common/RoleSwitcher';
import { ToastContainer } from '../components/common/ToastContainer';
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
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Admin Metrics', href: '/admin', icon: TrendingUp },
    { label: 'User Governance', href: '/admin/users', icon: Users },
    { label: 'Course Catalog', href: '/admin/courses', icon: BookCheck },
    { label: 'Create New Course', href: '/admin/courses/new', icon: PlusCircle },
    { label: 'Financial Reports', href: '/admin/reports', icon: Sliders },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800 shrink-0">
        <div className="p-5 border-b border-slate-800">
          <EdufyLogo variant="white" size="md" />
        </div>

        {/* Admin Badge */}
        <div className="p-4 mx-3 my-3 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate">{currentUser?.name || 'Platform Admin'}</h4>
            <span className="text-[10px] text-emerald-400 font-semibold block uppercase tracking-wider">Super Administrator</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-800">
            <Link
              to="/courses"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
            >
              <Compass className="w-4 h-4" />
              <span>Public Marketplace</span>
            </Link>
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="bg-slate-950 rounded p-1">
            <RoleSwitcher />
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
        <EdufyLogo variant="white" size="sm" />
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 rounded p-1">
            <RoleSwitcher />
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-white"
            aria-label="Toggle admin menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 text-white p-4 space-y-2 border-b border-slate-800">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-200 rounded-lg hover:bg-slate-800"
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
        <header className="hidden md:flex items-center justify-between h-16 px-8 bg-white border-b border-[#E2E8F0]">
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
          <Outlet />
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};
