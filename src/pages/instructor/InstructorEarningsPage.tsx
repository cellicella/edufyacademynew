import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, Download, CreditCard, CheckCircle2, Receipt } from 'lucide-react';
import { instructorService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const InstructorEarningsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    instructorService
      .getDashboardMetrics(currentUser?.id)
      .then(setMetrics)
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  const totalEarnings = metrics?.totalEarnings ?? 0;
  const currentMonthEarnings = metrics?.thisMonthEarnings ?? 0;
  const sales = metrics?.recentSales ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#111827]">Earnings & Payout Ledger</h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Review revenue distributions, student enrollment sales, and automated direct payouts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Accumulated Earnings</div>
          <div className="font-display text-2xl font-bold text-[#111827] mt-1 tabular-nums">
            ${loading ? '...' : totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Total revenue generated</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Current Month Estimate</div>
          <div className="font-display text-2xl font-bold text-emerald-600 mt-1 tabular-nums">
            ${loading ? '...' : currentMonthEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Pending next monthly cycle</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Payout Channel</div>
          <div className="font-display text-base font-bold text-[#111827] mt-1 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#004AAD]" />
            <span>Direct Bank Transfer / UPI</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified & Connected
          </div>
        </div>
      </div>

      {/* Payout Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-[#111827]">Disbursement & Sales History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[#64748B]">Loading ledger...</div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-3">
            <Receipt className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <h3 className="font-display text-sm font-bold text-[#111827]">No disbursement history found</h3>
            <p>Automated payouts and enrollment sales will be recorded as students purchase your courses.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="p-4 font-semibold">Sale / Payout ID</th>
                  <th className="p-4 font-semibold">Student / Reference</th>
                  <th className="p-4 font-semibold">Course Item</th>
                  <th className="p-4 font-semibold">Amount</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {sales.map((item: any) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC]">
                    <td className="p-4 font-mono font-bold text-[#111827]">{item.id.substring(0, 8).toUpperCase()}</td>
                    <td className="p-4 text-[#111827]">{item.studentName}</td>
                    <td className="p-4 text-[#64748B] max-w-xs truncate">{item.courseTitle}</td>
                    <td className="p-4 font-mono tabular-nums font-bold text-emerald-600">
                      +${item.amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-[#64748B]">{item.date}</td>
                    <td className="p-4 text-right">
                      <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                        Captured
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
