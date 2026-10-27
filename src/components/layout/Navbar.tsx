import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { EdufyLogo } from '../common/EdufyLogo';
import { RoleSwitcher } from '../common/RoleSwitcher';
import { useAuth } from '../../context/AuthContext';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { Search, Heart, ShoppingBag, Menu, X, BookOpen, User, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { currentUser, role, logout } = useAuth();
  const { wishlist, cartCount, setIsCartOpen, enrolledCourseIds } = useCartWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/courses?search=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { label: 'Courses', href: '/courses' },
    { label: 'Categories', href: '/categories' },
    { label: 'Instructors', href: '/instructors' },
    { label: 'Teach on Edufy', href: '/become-instructor' },
    { label: 'Verify', href: '/verify-certificate' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-6 shrink-0">
          <EdufyLogo size="md" />

          {/* Inline Compact Search for Desktop */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden lg:flex items-center relative w-64 xl:w-72"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 1,200+ courses..."
              aria-label="Search courses"
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#004AAD] focus:ring-1 focus:ring-[#004AAD] text-[#111827] placeholder-[#64748B] transition-all"
            />
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 pointer-events-none" />
          </form>
        </div>

        {/* Zone 2: Navigation Links (Single-Line Text Links) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#64748B]">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  isActive
                    ? 'text-[#004AAD] font-semibold border-b-2 border-[#004AAD]'
                    : 'hover:text-[#111827]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Actions & Auth State */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Role Switcher */}
          <div className="hidden sm:block">
            <RoleSwitcher />
          </div>

          {/* Wishlist Link with counter */}
          <Link
            to="/student/wishlist"
            className="relative p-2 text-[#64748B] hover:text-[#004AAD] transition-colors"
            aria-label={`Wishlist (${wishlist.length} items)`}
          >
            <Heart className="w-5 h-5" />
            {wishlist.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#5E17EB] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {wishlist.length}
              </span>
            )}
          </Link>

          {/* Shopping Cart Drawer Trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 text-[#64748B] hover:text-[#004AAD] transition-colors"
            aria-label={`Shopping Cart (${cartCount} items)`}
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#004AAD] text-white text-[10px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                {cartCount}
              </span>
            )}
          </button>

          {/* Auth Button or User Menu */}
          {currentUser ? (
            <div className="flex items-center gap-2.5">
              <Link
                to={role === 'admin' ? '/admin' : role === 'instructor' ? '/instructor' : '/student'}
                className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1.5 text-xs font-semibold text-[#111827] bg-[#F7F9FC] hover:bg-[#EBF3FF] border border-[#E2E8F0] rounded-lg transition-colors"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="truncate max-w-[110px]">{currentUser.name.split(' ')[0]}</span>
              </Link>

              <button
                onClick={logout}
                title="Log out"
                aria-label="Log out"
                className="p-2 text-[#64748B] hover:text-rose-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-medium text-[#111827] hover:text-[#004AAD] transition-colors whitespace-nowrap"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors whitespace-nowrap shadow-sm"
              >
                Get Started
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#111827] hover:text-[#004AAD] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E2E8F0] bg-white px-4 pt-3 pb-6 space-y-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses..."
              aria-label="Search courses"
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
            />
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
          </form>

          <div className="pt-1 pb-1">
            <RoleSwitcher />
          </div>

          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-[#111827] hover:bg-[#F7F9FC] rounded-lg"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/student"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-medium text-[#004AAD] hover:bg-[#F7F9FC] rounded-lg flex items-center justify-between"
            >
              <span>Student Dashboard</span>
              <span className="text-xs text-[#64748B] tabular-nums">{enrolledCourseIds.length} enrolled</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
