/**
 * Indian rupee amounts for display: "₹499", "₹1,299.50", "₹1,29,999.00" (Indian digit grouping).
 * decimals: 2 → always two decimals (invoices, reports); 0 → whole rupees; omitted → decimals only when needed.
 * Accepts numbers or numeric strings (Supabase numeric columns can arrive as strings); anything else shows ₹0.
 */
export function formatINR(value: number | string | null | undefined, decimals?: 0 | 2): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  const v = Number.isFinite(n) ? n : 0;
  const d = decimals ?? (Math.round(v * 100) % 100 === 0 ? 0 : 2);
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
