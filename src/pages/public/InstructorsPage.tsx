import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { instructorService } from '../../services/api';
import { Instructor } from '../../types';
import { Star, Users, BookOpen, ArrowRight, Award, Sparkles } from 'lucide-react';

export const InstructorsPage: React.FC = () => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    instructorService
      .getAllInstructors()
      .then(setInstructors)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Banner Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#004AAD] via-[#5271FF] to-[#5E17EB] rounded-2xl p-6 sm:p-10 mb-10 text-white shadow-xl border border-blue-400/20">
        <div className="absolute inset-0 bg-edufy-dots opacity-20 pointer-events-none" />
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md rounded-lg text-xs font-semibold text-blue-100 border border-white/20 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>World-Class Mentors</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Certified Edufy Instructors
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 mt-2 leading-relaxed">
            Learn from engineers, architects, and product designers who actively lead engineering initiatives at Fortune 500 tech companies.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-80 animate-pulse" />
          ))}
        </div>
      ) : instructors.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
          <Users className="w-10 h-10 text-[#64748B] mx-auto opacity-40" />
          <h3 className="font-display text-base font-bold text-[#111827]">No instructors available</h3>
          <p className="text-xs text-[#64748B]">Instructor profiles will appear here as educators join our faculty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {instructors.map((inst) => (
            <div
              key={inst.id}
              className="group bg-white rounded-xl border border-[#E2E8F0] p-6 hover:border-[#004AAD]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-center"
            >
              <div>
                <div className="relative mb-4 mx-auto inline-block">
                  <img
                    src={inst.avatar}
                    alt={inst.name}
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 rounded-full object-cover border-2 border-[#E2E8F0] group-hover:border-[#004AAD] group-hover:scale-105 transition-all duration-300 shadow-xs"
                  />
                  <div
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[9px] font-bold"
                    title="Verified Instructor"
                  >
                    ✓
                  </div>
                </div>
                <h2 className="font-display text-base font-bold text-[#111827] group-hover:text-[#004AAD] transition-colors">
                  {inst.name}
                </h2>
                <div className="text-xs text-[#004AAD] font-semibold mt-0.5">{inst.company}</div>
                <p className="text-xs text-[#64748B] mt-2 line-clamp-3 leading-relaxed">
                  {inst.bio}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-around text-xs text-[#64748B]">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span className="font-bold text-[#111827] tabular-nums">{inst.rating}</span>
                  </div>
                  <span>·</span>
                  <span className="tabular-nums font-medium">{inst.coursesCount} courses</span>
                  <span>·</span>
                  <span className="tabular-nums font-medium">{inst.totalStudents.toLocaleString()} students</span>
                </div>

                <Link
                  to={`/instructors/${inst.id}`}
                  className="w-full py-2 px-3 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <span>View Full Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
