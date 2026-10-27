import React, { useState, useEffect } from 'react';
import { Search, Shield, User, UserCheck, MoreVertical, Ban, CheckCircle2 } from 'lucide-react';
import { adminService } from '../../services/api';
import { useCartWishlist } from '../../context/CartWishlistContext';

export const AdminUsersPage: React.FC = () => {
  const { showToast } = useCartWishlist();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminService
      .getAllUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  const toggleUserStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextStatus = u.status === 'Active' ? 'Suspended' : 'Active';
          showToast(`User ${u.name} status updated to ${nextStatus}`, 'info');
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#111827]">User Management & Governance</h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Audit credentials, manage permissions, and enforce community trust standards.
        </p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user name or email..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
          />
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#64748B] font-medium">Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-[#F7F9FC] border border-[#E2E8F0] text-[#111827] py-1.5 px-3 rounded-lg focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="instructor">Instructors</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
            <div className="h-6 bg-slate-200 rounded w-48 mx-auto animate-pulse" />
            <p>Loading real registered accounts from database...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-3">
            <User className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <h3 className="font-display text-sm font-bold text-[#111827]">No user accounts found</h3>
            <p>No user profiles match your filter criteria or have registered in the database yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="p-4 font-semibold">User</th>
                  <th className="p-4 font-semibold">Account Role</th>
                  <th className="p-4 font-semibold">Enrollments</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Joined</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F8FAFC]">
                    <td className="p-4">
                      <div className="font-bold text-[#111827]">{user.name}</div>
                      <div className="text-[11px] text-[#64748B]">{user.email}</div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          user.role === 'admin'
                            ? 'bg-rose-50 text-rose-700'
                            : user.role === 'instructor'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4 font-mono">{user.enrolled}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          user.status === 'Active' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {user.status === 'Active' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Ban className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        <span>{user.status}</span>
                      </span>
                    </td>
                    <td className="p-4 text-[#64748B]">{user.joined}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        className={`text-xs font-semibold hover:underline ${
                          user.status === 'Active' ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {user.status === 'Active' ? 'Suspend' : 'Activate'}
                      </button>
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
