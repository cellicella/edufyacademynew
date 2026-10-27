/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CourseProgressProvider } from './context/CourseProgressContext';
import { CartWishlistProvider } from './context/CartWishlistContext';

// Layouts
import { MainLayout } from './layouts/MainLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { InstructorLayout } from './layouts/InstructorLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Public Pages
import { HomePage } from './pages/public/HomePage';
import { MarketplacePage } from './pages/public/MarketplacePage';
import { CourseDetailsPage } from './pages/public/CourseDetailsPage';
import { CategoriesPage } from './pages/public/CategoriesPage';
import { InstructorsPage } from './pages/public/InstructorsPage';
import { InstructorDetailsPage } from './pages/public/InstructorDetailsPage';
import { CertificateVerificationPage } from './pages/public/CertificateVerificationPage';
import { AboutPage } from './pages/public/AboutPage';
import { ContactPage } from './pages/public/ContactPage';
import { FaqPage } from './pages/public/FaqPage';
import { LegalPage } from './pages/public/LegalPage';
import { BecomeInstructorPage } from './pages/public/BecomeInstructorPage';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Student Portal Pages
import { StudentDashboardPage } from './pages/student/StudentDashboardPage';
import { MyCoursesPage } from './pages/student/MyCoursesPage';
import { LearningPlayerPage } from './pages/student/LearningPlayerPage';
import { QuizPage } from './pages/student/QuizPage';
import { StudentCertificatesPage } from './pages/student/StudentCertificatesPage';
import { StudentWishlistPage } from './pages/student/StudentWishlistPage';
import { StudentProfilePage } from './pages/student/StudentProfilePage';

// Instructor Portal Pages
import { InstructorDashboardPage } from './pages/instructor/InstructorDashboardPage';
import { InstructorCoursesPage } from './pages/instructor/InstructorCoursesPage';
import { CourseCreatorPage } from './pages/instructor/CourseCreatorPage';
import { InstructorStudentsPage } from './pages/instructor/InstructorStudentsPage';
import { InstructorEarningsPage } from './pages/instructor/InstructorEarningsPage';

// Admin Portal Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminCoursesPage } from './pages/admin/AdminCoursesPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';

// Scroll to top helper
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <CourseProgressProvider>
        <CartWishlistProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              {/* Public Website Routes */}
              <Route path="/" element={<MainLayout />}>
                <Route index element={<HomePage />} />
                <Route path="courses" element={<MarketplacePage />} />
                <Route path="courses/:id" element={<CourseDetailsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="instructors" element={<InstructorsPage />} />
                <Route path="instructors/:id" element={<InstructorDetailsPage />} />
                <Route path="verify-certificate" element={<CertificateVerificationPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="become-instructor" element={<BecomeInstructorPage />} />
                <Route path="faq" element={<FaqPage />} />
                <Route path="privacy" element={<LegalPage />} />
                <Route path="terms" element={<LegalPage />} />
                <Route path="refund" element={<LegalPage />} />
              </Route>

              {/* Authentication Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Learning Player & Quiz (Immersive Full Screen) */}
              <Route
                path="/learn/:courseId"
                element={
                  <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
                    <LearningPlayerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/learn/:courseId/quiz/:quizId"
                element={
                  <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
                    <QuizPage />
                  </ProtectedRoute>
                }
              />

              {/* Student Application Portal */}
              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
                    <StudentLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<StudentDashboardPage />} />
                <Route path="courses" element={<MyCoursesPage />} />
                <Route path="certificates" element={<StudentCertificatesPage />} />
                <Route path="wishlist" element={<StudentWishlistPage />} />
                <Route path="profile" element={<StudentProfilePage />} />
              </Route>

              {/* Instructor Studio Portal */}
              <Route
                path="/instructor"
                element={
                  <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                    <InstructorLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<InstructorDashboardPage />} />
                <Route path="courses" element={<InstructorCoursesPage />} />
                <Route path="courses/new" element={<CourseCreatorPage />} />
                <Route path="courses/:id/edit" element={<CourseCreatorPage />} />
                <Route path="students" element={<InstructorStudentsPage />} />
                <Route path="earnings" element={<InstructorEarningsPage />} />
              </Route>

              {/* Admin Governance Portal */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="courses" element={<AdminCoursesPage />} />
                <Route path="courses/new" element={<CourseCreatorPage />} />
                <Route path="courses/:id/edit" element={<CourseCreatorPage />} />
                <Route path="reports" element={<AdminReportsPage />} />
              </Route>

              {/* 404 Catch-All */}
              <Route
                path="*"
                element={
                  <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <h1 className="font-display text-4xl font-extrabold text-[#111827]">404</h1>
                    <p className="text-sm text-[#64748B]">The requested page could not be located.</p>
                    <a
                      href="/"
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] rounded-lg"
                    >
                      Return to Edufy Home
                    </a>
                  </div>
                }
              />
            </Routes>
          </BrowserRouter>
        </CartWishlistProvider>
      </CourseProgressProvider>
    </AuthProvider>
  );
}
