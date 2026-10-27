import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { EdufyLogo } from './EdufyLogo';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { currentUser, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center p-6 space-y-4">
        <EdufyLogo size="md" />
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#004AAD]/30 border-t-[#004AAD] rounded-full animate-spin" />
          <span className="text-xs font-semibold text-[#64748B]">Verifying your session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnUrl}`} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    // Redirect to the user's respective portal
    if (currentUser.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (currentUser.role === 'instructor') {
      return <Navigate to="/instructor" replace />;
    }
    return <Navigate to="/student" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
