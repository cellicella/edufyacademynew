import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, Layers, Upload, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bundleService, courseService, BundleInput } from '../../services/api';
import { Bundle, Course } from '../../types';
import { AdminPageHeader, inr, EmptyState, ErrorBanner } from '../../components/admin/AdminUI';
import { useCartWishlist } from '../../context/CartWishlistContext';

const emptyForm: BundleInput = { title: '', subtitle: '', description: '', thumbnail: '', price: 0, isPublished: false, courseIds: [] };

export const AdminBundlesPage: React.FC = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BundleInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [courseQuery, setCourseQuery] = useState('');
  const { showToast } = useCartWishlist();

  const load = async () => {
    try {
      const [b, c] = await Promise.all([bundleService.getAllBundles(), courseService.getAdminCourses()]);
      setBundles(b);
      setCourses(c);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const courseById = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);
  const selectedCourses = (form?.courseIds || []).map((id) => courseById[id]).filter(Boolean) as Course[];
  const selectedValue = selectedCourses.reduce((s, c) => s + c.price, 0);

  const openEditor = (b?: Bundle) =>
    setForm(
      b
        ? { id: b.id, title: b.title, subtitle: b.subtitle, description: b.description, thumbnail: b.thumbnail, price: b.price, isPublished: b.isPublished, courseIds: b.courses.map((c) => c.id) }
        : { ...emptyForm }
    );

  const toggleCourse = (id: string) =>
    form && setForm({ ...form, courseIds: form.courseIds.includes(id) ? form.courseIds.filter((x) => x !== id) : [...form.courseIds, id] });

  const move = (idx: number, dir: -1 | 1) => {
    if (!form) return;
    const ids = [...form.courseIds];
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    setForm({ ...form, courseIds: ids });
  };

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) return showToast('Give the bundle a title', 'warning');
    if (form.courseIds.length < 2) return showToast('A bundle needs at least 2 courses', 'warning');
    if (form.isPublished && selectedCourses.some((c) => !c.isPublished)) return showToast('Only published courses can be in a live bundle', 'warning');
    setSaving(true);
    try {
      await bundleService.saveBundle(form);
      showToast('Bundle saved', 'success');
      setForm(null);
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: Bundle) => {
    if (!window.confirm(`Delete bundle “${b.title}”? Learners who bought it keep their courses.`)) return;
    try {
      await bundleService.deleteBundle(b.id);
      showToast('Bundle deleted', 'info');
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const uploadThumb = async (file?: File) => {
    if (!file || !form) return;
    setUploading(true);
    try {
      const res = await courseService.uploadMedia(file, 'course-thumbnails');
      setForm({ ...form, thumbnail: res.url });
    } catch (e: any) {
      showToast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const pickable = courses.filter((c) => !courseQuery || c.title.toLowerCase().includes(courseQuery.toLowerCase()));

  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Course bundles"
        description="Package several courses together at a single price. Buyers are enrolled in every course in the bundle."
        actions={<button onClick={() => openEditor()} className="ed-btn ed-btn-filled ed-btn-sm"><Plus className="w-4 h-4" /> New bundle</button>}
      />
      {error && <ErrorBanner message={error} />}

      <section className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
              <tr><th className="px-6 py-3">Bundle</th><th className="px-6 py-3 text-right">Courses</th><th className="px-6 py-3 text-right">Value</th><th className="px-6 py-3 text-right">Price</th><th className="px-6 py-3">Status</th><th className="px-6 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {bundles.map((b) => (
                <tr key={b.id}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-11 rounded-lg overflow-hidden bg-[#E8EFFB] shrink-0">{b.thumbnail && <img src={b.thumbnail} alt="" className="w-full h-full object-cover" />}</div>
                      <div className="min-w-0"><div className="font-semibold text-[#111827] truncate">{b.title}</div><div className="text-[13px] text-[#64748B] truncate">{b.subtitle}</div></div>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">{b.courses.length}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-[#94A3B8] line-through">{inr(b.coursesValue)}</td>
                  <td className="px-6 py-3 text-right tabular-nums font-semibold">{inr(b.price)}</td>
                  <td className="px-6 py-3"><span className={`px-2.5 h-7 inline-flex items-center rounded-full text-[13px] font-semibold ${b.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F1F5F9] text-[#475569]'}`}>{b.isPublished ? 'Live' : 'Draft'}</span></td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    {b.isPublished && <Link to={`/bundles/${b.slug}`} className="ed-btn ed-btn-text ed-btn-sm"><Eye className="w-4 h-4" /></Link>}
                    <button onClick={() => openEditor(b)} className="ed-btn ed-btn-text ed-btn-sm" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(b)} className="ed-btn ed-btn-text ed-btn-sm !text-rose-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bundles.length === 0 && <EmptyState title="No bundles yet" body="Create your first bundle to offer several courses at one price." />}
        </div>
      </section>

      {/* Editor dialog */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Bundle editor">
          <div className="fixed inset-0 bg-[#111827]/40" onClick={() => setForm(null)} />
          <div className="relative w-full max-w-5xl bg-white rounded-[28px] shadow-2xl my-8 edufy-pop">
            <div className="flex items-center justify-between p-6 border-b border-[#EEF2F7]">
              <h2 className="font-display text-[24px] font-bold text-[#111827]">{form.id ? 'Edit bundle' : 'New bundle'}</h2>
              <button onClick={() => setForm(null)} className="w-10 h-10 rounded-full hover:bg-[#F1F5F9] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
              <div className="space-y-4">
                <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Title</span>
                  <input className="ed-field mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Full-Stack Developer Career Bundle" /></label>
                <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Short description</span>
                  <input className="ed-field mt-1.5" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></label>
                <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Full description</span>
                  <textarea rows={5} className="ed-field mt-1.5 !h-auto py-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                <div>
                  <span className="text-[15px] font-semibold text-[#111827]">Thumbnail</span>
                  <div className="mt-1.5 flex gap-3 items-center">
                    <div className="w-28 aspect-video rounded-lg overflow-hidden bg-[#E8EFFB] shrink-0">{form.thumbnail && <img src={form.thumbnail} alt="" className="w-full h-full object-cover" />}</div>
                    <input className="ed-field" value={form.thumbnail} onChange={(e) => setForm({ ...form, thumbnail: e.target.value })} placeholder="Image URL" />
                    <label className="ed-btn ed-btn-tonal ed-btn-sm cursor-pointer shrink-0"><Upload className="w-4 h-4" />{uploading ? '…' : 'Upload'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadThumb(e.target.files?.[0])} /></label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Bundle price (₹)</span>
                    <input type="number" min={0} className="ed-field mt-1.5" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></label>
                  <div className="text-[15px] text-[#64748B] self-end pb-3">
                    Courses value: <b className="text-[#111827]">{inr(selectedValue)}</b>
                    {selectedValue > form.price && <div className="text-[#5E17EB] font-semibold">Learners save {inr(selectedValue - form.price)}</div>}
                  </div>
                </div>
                <label className="flex items-center gap-3 text-[16px] font-medium text-[#111827] cursor-pointer">
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="w-5 h-5" />
                  Publish bundle (visible on /bundles)
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[15px] font-semibold text-[#111827] mb-2 flex items-center gap-2"><Layers className="w-4 h-4 text-[#5E17EB]" /> Courses in this bundle ({selectedCourses.length})</div>
                  {selectedCourses.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#F7F9FC] text-[15px] text-[#64748B]">Select at least two courses below.</div>
                  ) : (
                    <ol className="space-y-2">
                      {selectedCourses.map((c, i) => (
                        <li key={c.id} className="flex items-center gap-3 p-2 pr-3 rounded-xl border border-[#E2E8F0]">
                          <span className="w-6 text-center text-[13px] font-bold text-[#94A3B8]">{i + 1}</span>
                          <span className="flex-1 min-w-0 truncate text-[15px] font-medium">{c.title}</span>
                          {!c.isPublished && <span className="text-[12px] text-amber-700 bg-amber-50 px-2 rounded">draft</span>}
                          <span className="text-[14px] tabular-nums text-[#64748B]">{inr(c.price)}</span>
                          <button onClick={() => move(i, -1)} className="p-1 hover:bg-[#F1F5F9] rounded" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                          <button onClick={() => move(i, 1)} className="p-1 hover:bg-[#F1F5F9] rounded" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                          <button onClick={() => toggleCourse(c.id)} className="p-1 hover:bg-rose-50 text-rose-600 rounded" aria-label="Remove"><X className="w-4 h-4" /></button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <input className="ed-field" placeholder="Search courses to add" value={courseQuery} onChange={(e) => setCourseQuery(e.target.value)} />
                  <ul className="mt-2 max-h-72 overflow-y-auto divide-y divide-[#EEF2F7] border border-[#E2E8F0] rounded-2xl">
                    {pickable.map((c) => (
                      <li key={c.id}>
                        <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F7F9FC]">
                          <input type="checkbox" checked={form.courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} className="w-4 h-4" />
                          <span className="flex-1 min-w-0 truncate text-[15px]">{c.title}</span>
                          <span className="text-[13px] text-[#64748B]">{c.instructor.name}</span>
                          <span className="text-[14px] tabular-nums">{inr(c.price)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-[#EEF2F7]">
              <button onClick={() => setForm(null)} className="ed-btn ed-btn-outlined ed-btn-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="ed-btn ed-btn-filled ed-btn-sm">{saving ? 'Saving…' : 'Save bundle'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
