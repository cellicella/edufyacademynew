import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { EdufyLogo } from '../components/common/EdufyLogo';
import { ToastContainer } from '../components/common/ToastContainer';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Layers,
  Users,
  DollarSign,
  PlusCircle,
  LogOut,
  Compass,
  Menu,
  X,
  FileCheck,
} from 'lucide-react';

export const InstructorLayout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Instructor Overview', href: '/instructor', icon: LayoutDashboard },
    { label: 'Course Management', href: '/instructor/courses', icon: Layers },
    { label: 'Create New Course', href: '/instructor/courses/new', icon: PlusCircle },
    { label: 'Student Enrollees', href: '/instructor/students', icon: Users },
    { label: 'Earnings & Payouts', href: '/instructor/earnings', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-white text-[#111827] border-r border-[#E2E8F0] shrink-0">
        <div className="p-5 border-b border-[#E2E8F0]">
          <EdufyLogo size="md" />
        </div>

        {/* Instructor Badge */}
        <div className="p-4 mx-3 my-3 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl flex items-center gap-3">
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80'}
            alt="Instructor"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border border-[#E2E8F0]"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[#111827] truncate">{currentUser?.name || 'Instructor'}</h4>
            <span className="text-[12px] text-[#5E17EB] font-semibold block uppercase tracking-wider">Instructor Portal</span>
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
                className={`flex items-center gap-3 px-4 h-12 rounded-full text-[15px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#F1EAFE] text-[#4A12BC]'
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
            aria-label="Toggle instructor menu"
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
              <item.icon className="w-4 h-4 text-[#5E17EB]" />
              <span>{item.label}</span>
            </Link>
          ))}
          <Link
            to="/courses"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#5E17EB]"
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
            <h1 className="text-sm font-bold text-[#111827]">Instructor Studio</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#64748B]">
              Visual Prototype Mode · REST API Schema Ready
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
