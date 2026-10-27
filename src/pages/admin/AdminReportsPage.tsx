import React, { useState, useEffect } from 'react';
import { DollarSign, Download, TrendingUp, CreditCard, ShieldCheck, Receipt } from 'lucide-react';
import { adminService } from '../../services/api';

export const AdminReportsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([adminService.getAllTransactions(), adminService.getPlatformAnalytics()])
      .then(([txs, stats]) => {
        setTransactions(txs);
        setAnalytics(stats);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalGross = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalFee = Number((totalGross * 0.1).toFixed(2));
  const totalPayout = Number((totalGross - totalFee).toFixed(2));

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert('No ledger transactions available to export.');
      return;
    }
    const headers = 'Transaction ID,Student,Course,Gross,Edufy Fee,Payout,Status,Date\n';
    const rows = transactions
      .map(
        (t) =>
          `"${t.id}","${t.user}","${t.course}",${t.amount},${t.fee},${t.payout},"${t.status}","${t.date}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edufy_ledger_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111827]">Financial Settlement Reports</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Platform gross marketplace revenue, payment gateway processing fees, and instructor disbursements.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow"
        >
          <Download className="w-4 h-4" />
          <span>Export All Ledgers (CSV)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Platform Gross Volume</div>
          <div className="font-display text-2xl font-bold text-[#111827] mt-1 tabular-nums">
            ${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Live payments recorded</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Platform Commission (10%)</div>
          <div className="font-display text-2xl font-bold text-[#004AAD] mt-1 tabular-nums">
            ${totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Platform operations net take</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#64748B]">Instructor Direct Disbursements (90%)</div>
          <div className="font-display text-2xl font-bold text-emerald-600 mt-1 tabular-nums">
            ${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Allocated to instructor payouts</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
            <div className="h-6 bg-slate-200 rounded w-48 mx-auto animate-pulse" />
            <p>Loading financial transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-3">
            <Receipt className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
            <h3 className="font-display text-sm font-bold text-[#111827]">No financial records found</h3>
            <p>Settled payments and revenue disbursements will populate as students complete purchases via Razorpay.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="p-4 font-semibold">Transaction ID</th>
                  <th className="p-4 font-semibold">Student</th>
                  <th className="p-4 font-semibold">Course Item</th>
                  <th className="p-4 font-semibold">Gross</th>
                  <th className="p-4 font-semibold">Edufy Fee (10%)</th>
                  <th className="p-4 font-semibold">Instructor Payout</th>
                  <th className="p-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F8FAFC]">
                    <td className="p-4 font-mono font-bold text-[#111827]">{t.id}</td>
                    <td className="p-4 text-[#111827] font-medium">{t.user}</td>
                    <td className="p-4 text-[#64748B] max-w-xs truncate">{t.course}</td>
                    <td className="p-4 font-mono tabular-nums font-bold text-[#111827]">
                      ${t.amount.toFixed(2)}
                    </td>
                    <td className="p-4 font-mono tabular-nums text-[#004AAD]">${t.fee.toFixed(2)}</td>
                    <td className="p-4 font-mono tabular-nums font-semibold text-emerald-600">
                      ${t.payout.toFixed(2)}
                    </td>
                    <td className="p-4 text-right">
                      <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                        {t.status}
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
