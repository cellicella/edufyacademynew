import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { EdufyLogo } from '../components/common/EdufyLogo';
import { RoleSwitcher } from '../components/common/RoleSwitcher';
import { ToastContainer } from '../components/common/ToastContainer';
import { CartDrawer } from '../components/common/CartDrawer';
import { useAuth } from '../context/AuthContext';
import { useCartWishlist } from '../context/CartWishlistContext';
import {
  LayoutDashboard,
  BookOpen,
  Award,
  Heart,
  User,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Compass,
  CheckCircle2,
} from 'lucide-react';

export const StudentLayout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { wishlist, enrolledCourseIds } = useCartWishlist();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const navItems = [
    { label: 'Overview', href: '/student', icon: LayoutDashboard },
    { label: 'My Courses', href: '/student/courses', icon: BookOpen, count: enrolledCourseIds.length },
    { label: 'Certificates', href: '/student/certificates', icon: Award, count: 2 },
    { label: 'Wishlist', href: '/student/wishlist', icon: Heart, count: wishlist.length },
    { label: 'Profile & Settings', href: '/student/profile', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E2E8F0] shrink-0">
        <div className="p-5 border-b border-[#E2E8F0]">
          <EdufyLogo size="md" />
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center gap-3">
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
            alt="User avatar"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border border-[#E2E8F0]"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[#111827] truncate">{currentUser?.name || 'Student'}</h4>
            <span className="text-[11px] text-[#64748B] block truncate">Student Account</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#EBF3FF] text-[#004AAD]'
                    : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#004AAD]' : 'text-[#64748B]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-[#004AAD] text-white' : 'bg-[#E2E8F0] text-[#64748B]'
                  }`}>
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-[#E2E8F0]">
            <Link
              to="/courses"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-[#64748B] hover:text-[#004AAD] hover:bg-[#F8FAFC] transition-colors"
            >
              <Compass className="w-4 h-4 text-[#64748B]" />
              <span>Course Marketplace</span>
            </Link>
          </div>
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-[#E2E8F0] space-y-2">
          <RoleSwitcher />
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
      <div className="md:hidden bg-white border-b border-[#E2E8F0] p-4 flex items-center justify-between">
        <EdufyLogo size="sm" />
        <div className="flex items-center gap-2">
          <RoleSwitcher />
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 text-[#111827]"
            aria-label="Toggle student menu"
          >
            {mobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="md:hidden bg-white border-b border-[#E2E8F0] p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileSidebarOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#111827] rounded-lg hover:bg-[#F8FAFC]"
            >
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4 text-[#004AAD]" />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span className="text-[10px] bg-[#E2E8F0] text-[#64748B] px-1.5 py-0.5 rounded-full">
                  {item.count}
                </span>
              )}
            </Link>
          ))}
          <Link
            to="/courses"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#004AAD]"
          >
            <Compass className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </Link>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar inside student portal */}
        <header className="hidden md:flex items-center justify-between h-16 px-8 bg-white border-b border-[#E2E8F0]">
          <div className="text-sm font-semibold text-[#111827]">
            Student Learning Workspace
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowNotificationModal(!showNotificationModal)}
              className="relative p-2 text-[#64748B] hover:text-[#111827] rounded-lg transition-colors"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <Link
              to="/courses"
              className="text-xs font-semibold text-[#004AAD] hover:underline"
            >
              Browse Catalog
            </Link>
          </div>
        </header>

        {/* Notifications modal popover */}
        {showNotificationModal && (
          <div className="absolute right-8 top-16 w-80 bg-white border border-[#E2E8F0] shadow-xl rounded-xl p-4 z-50 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] mb-3">
              <span className="font-bold text-[#111827]">Notifications</span>
              <button
                onClick={() => setShowNotificationModal(false)}
                className="text-[#64748B] hover:text-[#111827]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="py-4 text-center text-xs text-[#64748B] space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto opacity-60 mb-1" />
              <p className="font-semibold text-[#111827]">You're all caught up</p>
              <p className="text-[11px]">No unread system or course notifications.</p>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          <Outlet />
        </div>
      </div>

      <ToastContainer />
      <CartDrawer />
    </div>
  );
};
