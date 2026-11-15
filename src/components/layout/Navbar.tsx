import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { EdufyLogo } from '../common/EdufyLogo';
import { useAuth } from '../../context/AuthContext';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { courseService } from '../../services/api';
import {
  Search,
  Heart,
  ShoppingBag,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  UserRound,
  Award,
  ArrowUpRight,
  CornerDownLeft,
} from 'lucide-react';

const navLinks = [
  { label: 'Courses', href: '/courses' },
  { label: 'Bundles', href: '/bundles' },
  { label: 'Categories', href: '/categories' },
  { label: 'Instructors', href: '/instructors' },
  { label: 'Blog', href: '/blog' },
  { label: 'Verify certificate', href: '/verify-certificate' },
];


export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { currentUser, role, logout } = useAuth();
  const { wishlist, cartCount, setIsCartOpen } = useCartWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  // "Browse a discipline" chips: the categories with the most courses (from the database)
  const [quickTopics, setQuickTopics] = useState<{ label: string; slug: string }[]>([]);
  useEffect(() => {
    courseService
      .getCategories()
      .then((cats) => setQuickTopics([...cats].sort((a, b) => b.courseCount - a.courseCount).slice(0, 6).map((c) => ({ label: c.name, slug: c.slug }))))
      .catch(() => undefined);
  }, []);

  const dashboardHref = role === 'admin' ? '/admin' : role === 'instructor' ? '/instructor' : '/student';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close overlays on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  // Keyboard: "/" or Ctrl/Cmd+K opens search, Esc closes overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setAccountOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 30);
  }, [searchOpen]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/courses?search=${encodeURIComponent(q)}` : '/courses');
    setSearchOpen(false);
  };

  const iconButton =
    'relative inline-flex items-center justify-center w-11 h-11 rounded-full text-[#334155] hover:bg-[#E8EFFB] hover:text-[#004AAD] transition-colors';

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300 border-b ${
          scrolled
            ? 'bg-white/90 backdrop-blur-xl border-[#E2E8F0] shadow-[0_8px_24px_-16px_rgba(17,24,39,0.18)]'
            : 'bg-[#F7F9FC] border-transparent'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-[76px] flex items-center gap-3 sm:gap-4">
          <EdufyLogo size="md" />

          <nav className="hidden lg:flex items-center gap-1 ml-6" aria-label="Primary">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  `px-3.5 h-11 items-center rounded-full text-[15px] leading-none font-medium whitespace-nowrap transition-colors ${link.href === '/verify-certificate' || link.href === '/categories' || link.href === '/blog' ? 'hidden xl:inline-flex' : 'inline-flex'} ${
                    isActive ? 'text-[#004AAD] bg-[#E8EFFB]' : 'text-[#334155] hover:text-[#111827] hover:bg-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Search trigger — opens the discovery dialog */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:inline-flex items-center gap-2.5 h-11 pl-4 pr-1.5 w-48 lg:w-52 xl:w-72 shrink-0 rounded-full bg-white border border-[#E2E8F0] text-[15px] leading-none text-[#64748B] whitespace-nowrap hover:border-[#CBD5E1] hover:shadow-sm transition"
            aria-label="Search courses"
          >
            <Search className="w-[18px] h-[18px] shrink-0" />
            <span className="flex-1 min-w-0 text-left truncate">Find a course</span>
            <kbd className="hidden xl:inline-flex items-center shrink-0 px-2 h-8 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-[12px] leading-none font-sans font-medium text-[#64748B] whitespace-nowrap">
              Ctrl K
            </kbd>
          </button>
          <button onClick={() => setSearchOpen(true)} className={`${iconButton} md:hidden`} aria-label="Search courses">
            <Search className="w-5 h-5" />
          </button>


          <Link to="/student/wishlist" className={`${iconButton} hidden sm:inline-flex`} aria-label={`Wishlist (${wishlist.length})`}>
            <Heart className="w-5 h-5" />
            {wishlist.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#5E17EB] text-white text-[11px] font-bold flex items-center justify-center tabular-nums ring-2 ring-white">
                {wishlist.length}
              </span>
            )}
          </Link>

          <button onClick={() => setIsCartOpen(true)} className={iconButton} aria-label={`Cart (${cartCount})`}>
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#004AAD] text-white text-[11px] font-bold flex items-center justify-center tabular-nums ring-2 ring-white">
                {cartCount}
              </span>
            )}
          </button>

          {currentUser ? (
            <div className="relative" ref={accountRef}>
              <button
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2.5 h-11 pl-1 pr-1 sm:pr-3 rounded-full bg-white border border-[#E2E8F0] hover:shadow-sm transition"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label="Account menu"
              >
                <img src={currentUser.avatar} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover" />
                <span className="hidden sm:block text-[15px] font-semibold text-[#111827] max-w-[110px] truncate">
                  {currentUser.name.split(' ')[0]}
                </span>
              </button>

              {accountOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-2 origin-top-right edufy-pop">
                  <div className="px-3 py-3 border-b border-[#EEF2F7] mb-1">
                    <div className="text-[16px] font-semibold text-[#111827] truncate">{currentUser.name}</div>
                    <div className="text-[14px] text-[#64748B] truncate">{currentUser.email}</div>
                  </div>
                  {[
                    { to: dashboardHref, label: 'Dashboard', icon: LayoutDashboard },
                    { to: '/student/courses', label: 'My learning', icon: ArrowUpRight },
                    { to: '/student/certificates', label: 'Certificates', icon: Award },
                    { to: '/student/profile', label: 'Profile & settings', icon: UserRound },
                  ].map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      role="menuitem"
                      className="flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] text-[#334155] hover:bg-[#F7F9FC] hover:text-[#111827]"
                    >
                      <item.icon className="w-[18px] h-[18px] text-[#64748B]" />
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={logout}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[15px] text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="w-[18px] h-[18px]" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1">
              <Link to="/login" className="ed-btn ed-btn-text ed-btn-sm">
                Log in
              </Link>
              <Link to="/register" className="ed-btn ed-btn-filled ed-btn-sm">
                Start learning
              </Link>
            </div>
          )}

          <button onClick={() => setMobileMenuOpen(true)} className={`${iconButton} lg:hidden`} aria-label="Open menu">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* ---------------- Search / discovery dialog ---------------- */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search courses">
          <div className="absolute inset-0 bg-[#111827]/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden edufy-pop">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 px-5 sm:px-6 h-[72px] border-b border-[#EEF2F7]">
              <Search className="w-6 h-6 text-[#004AAD] shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What would you like to learn?"
                aria-label="Search query"
                className="flex-1 min-w-0 h-full text-[19px] text-[#111827] placeholder-[#94A3B8] bg-transparent focus:outline-none"
              />
              <button type="submit" className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#F1F5F9] text-[13px] font-semibold text-[#64748B]">
                Enter <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setSearchOpen(false)} className="w-10 h-10 shrink-0 rounded-full hover:bg-[#F1F5F9] inline-flex items-center justify-center text-[#64748B]" aria-label="Close search">
                <X className="w-5 h-5" />
              </button>
            </form>
            <div className="p-5 sm:p-6">
              <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#64748B] mb-3">Browse a discipline</div>
              <div className="flex flex-wrap gap-2">
                {quickTopics.map((t) => (
                  <Link key={t.slug} to={`/courses?category=${t.slug}`} className="ed-chip">
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Mobile navigation drawer ---------------- */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-[#111827]/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm bg-white shadow-2xl flex flex-col edufy-slide">
            <div className="flex items-center justify-between px-5 h-[76px] border-b border-[#EEF2F7]">
              <EdufyLogo size="sm" />
              <button onClick={() => setMobileMenuOpen(false)} className={iconButton} aria-label="Close menu">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              {navLinks.map((link) => (
                <Link key={link.href} to={link.href} className="flex items-center justify-between px-4 h-14 rounded-2xl text-[18px] font-semibold text-[#111827] hover:bg-[#F7F9FC]">
                  {link.label}
                  <ArrowUpRight className="w-5 h-5 text-[#94A3B8]" />
                </Link>
              ))}
              <Link to="/become-instructor" className="flex items-center justify-between px-4 h-14 rounded-2xl text-[18px] font-semibold text-[#5E17EB] hover:bg-[#F1EAFE]">
                Teach on Edufy
                <ArrowUpRight className="w-5 h-5" />
              </Link>
              {currentUser && (
                <Link to={dashboardHref} className="flex items-center justify-between px-4 h-14 rounded-2xl text-[18px] font-semibold text-[#004AAD] hover:bg-[#E8EFFB]">
                  My dashboard
                  <LayoutDashboard className="w-5 h-5" />
                </Link>
              )}
            </div>
            <div className="p-5 border-t border-[#EEF2F7] flex gap-3">
              {currentUser ? (
                <button onClick={logout} className="ed-btn ed-btn-outlined flex-1">
                  <LogOut className="w-4 h-4" /> Log out
                </button>
              ) : (
                <>
                  <Link to="/login" className="ed-btn ed-btn-outlined flex-1">Log in</Link>
                  <Link to="/register" className="ed-btn ed-btn-filled flex-1">Start learning</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
