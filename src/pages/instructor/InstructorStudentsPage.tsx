import React, { useState, useEffect } from 'react';
import { Users, Mail, CheckCircle2, Clock } from 'lucide-react';
import { instructorService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const InstructorStudentsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    instructorService
      .getInstructorStudents(currentUser?.id)
      .then(setStudents)
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#111827]">Enrolled Student Roster</h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Monitor learner progress, lesson completion rates, and active study sessions.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
            <div className="h-6 bg-slate-200 rounded w-48 mx-auto animate-pulse" />
            <p>Loading student roster...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-3">
            <Users className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <h3 className="font-display text-sm font-bold text-[#111827]">No students enrolled yet</h3>
            <p>Students will appear on this roster once they enroll in your published masterclasses.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="p-4 font-semibold">Student Name</th>
                  <th className="p-4 font-semibold">Active Course</th>
                  <th className="p-4 font-semibold">Curriculum Progress</th>
                  <th className="p-4 font-semibold">Enrolled Date</th>
                  <th className="p-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-[#F8FAFC]">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={st.avatar}
                          alt={st.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-bold text-[#111827]">{st.name}</div>
                          <div className="text-[11px] text-[#64748B]">{st.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-[#111827]">{st.enrolledIn}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 max-w-xs">
                        <div className="flex-1 bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#004AAD] h-full rounded-full"
                            style={{ width: `${st.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#111827] tabular-nums">
                          {st.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-[#64748B]">{st.lastActive}</td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Active</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
