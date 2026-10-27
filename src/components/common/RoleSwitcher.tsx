import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { UserCheck, Shield, GraduationCap, ChevronDown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const RoleSwitcher: React.FC = () => {
  const { role, switchRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roles: { id: UserRole; label: string; icon: React.ReactNode; targetPath: string }[] = [
    {
      id: 'student',
      label: 'Student View',
      icon: <GraduationCap className="w-4 h-4 text-[#004AAD]" />,
      targetPath: '/student',
    },
    {
      id: 'instructor',
      label: 'Instructor View',
      icon: <UserCheck className="w-4 h-4 text-[#5E17EB]" />,
      targetPath: '/instructor',
    },
    {
      id: 'admin',
      label: 'Platform Admin',
      icon: <Shield className="w-4 h-4 text-emerald-600" />,
      targetPath: '/admin',
    },
  ];

  const handleSelectRole = (newRole: UserRole, targetPath: string) => {
    switchRole(newRole);
    setIsOpen(false);
    navigate(targetPath);
  };

  const currentRoleConfig = roles.find((r) => r.id === role) || roles[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-[#111827] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] rounded-lg transition-colors whitespace-nowrap"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Switch active demonstration persona role"
      >
        <div className="flex items-center gap-1.5">
          {currentRoleConfig.icon}
          <span>{currentRoleConfig.label}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-52 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1.5 z-50 text-xs"
        >
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#64748B] tracking-wider border-b border-[#E2E8F0] mb-1">
            Demo Persona Switcher
          </div>
          {roles.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              onClick={() => handleSelectRole(item.id, item.targetPath)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors ${
                role === item.id ? 'bg-[#EBF3FF] text-[#004AAD] font-semibold' : 'text-[#111827]'
              }`}
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {role === item.id && <Check className="w-3.5 h-3.5 text-[#004AAD]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
