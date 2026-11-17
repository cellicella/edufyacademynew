import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, Upload, Eye, EyeOff, Search, FolderInput, Tags } from 'lucide-react';
import { AdminPageHeader, EmptyState, ErrorBanner } from '../../components/admin/AdminUI';
import { courseService } from '../../services/api';
import { Category, categoryService } from '../../services/content';
import { toSlug } from '../../utils/html';
import { Course } from '../../types';
import { useCartWishlist } from '../../context/CartWishlistContext';

interface Form {
  id?: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  imageUrl: string;
  icon: string;
  isActive: boolean;
}

const ICONS = ['Code2', 'Cpu', 'Palette', 'Cloud', 'Briefcase', 'ShieldCheck', 'BookOpen', 'BarChart3', 'Smartphone', 'Megaphone', 'Database', 'FileSpreadsheet', 'Camera', 'Languages', 'Calculator', 'GraduationCap'];

export const AdminCategoriesPage: React.FC = () => {
  const { showToast } = useCartWishlist();
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assignFor, setAssignFor] = useState<Category | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [courseQuery, setCourseQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [cats, crs] = await Promise.all([categoryService.listAdmin(), courseService.getAdminCourses()]);
      setCategories(cats);
      setCourses(crs);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(
    () =>
      categories.filter((c) => {
        if (filter === 'active' && !c.isActive) return false;
        if (filter === 'inactive' && c.isActive) return false;
        const q = query.trim().toLowerCase();
        return !q || c.name.toLowerCase().includes(q) || c.slug.includes(q) || c.description.toLowerCase().includes(q);
      }),
    [categories, filter, query]
  );

  const open = (c?: Category) =>
    setForm(
      c
        ? { id: c.id, name: c.name, slug: c.slug, slugTouched: true, description: c.description, imageUrl: c.imageUrl || '', icon: c.icon || '', isActive: c.isActive }
        : { name: '', slug: '', slugTouched: false, description: '', imageUrl: '', icon: 'BookOpen', isActive: true }
    );

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await categoryService.save({
        id: form.id,
        name: form.name,
        slug: form.slug,
        description: form.description,
        imageUrl: form.imageUrl || null,
        icon: form.icon || null,
        isActive: form.isActive,
        position: form.id ? undefined : categories.length + 1,
      });
      showToast(form.id ? 'Category updated' : 'Category created', 'success');
      setForm(null);
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Category) => {
    try {
      await categoryService.save({ id: c.id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, icon: c.icon, isActive: !c.isActive });
      showToast(c.isActive ? `“${c.name}” hidden from the catalog` : `“${c.name}” is visible again`, 'info');
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const remove = async (c: Category) => {
    if (c.courseCount > 0) return showToast(`Move the ${c.courseCount} course(s) in “${c.name}” to another category first.`, 'warning');
    if (!window.confirm(`Delete the category “${c.name}”? This can’t be undone.`)) return;
    try {
      await categoryService.remove(c);
      showToast('Category deleted', 'info');
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const list = [...categories];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    try {
      await categoryService.reorder(list.map((c) => c.id));
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const upload = async (file?: File) => {
    if (!file || !form) return;
    if (!file.type.startsWith('image/')) return showToast('Choose an image file', 'warning');
    setUploading(true);
    try {
      const r = await courseService.uploadMedia(file, 'course-thumbnails', 'category');
      setForm({ ...form, imageUrl: r.url });
    } catch (e: any) {
      showToast(e.message || 'Upload failed (the Edufy server is needed for uploads — you can paste an image link instead).', 'error');
    } finally {
      setUploading(false);
    }
  };

  const openAssign = (c: Category) => {
    setAssignFor(c);
    setSelected(new Set(courses.filter((x) => x.categorySlug === c.slug).map((x) => x.id)));
    setCourseQuery('');
  };

  const saveAssign = async () => {
    if (!assignFor) return;
    const toMove = courses.filter((c) => selected.has(c.id) && c.categorySlug !== assignFor.slug).map((c) => c.id);
    if (!toMove.length) return setAssignFor(null);
    setSaving(true);
    try {
      await categoryService.assignCourses(assignFor, toMove);
      showToast(`${toMove.length} course(s) moved to “${assignFor.name}”`, 'success');
      setAssignFor(null);
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const catName = (slug: string) => categories.find((c) => c.slug === slug)?.name || slug || '—';

  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Categories"
        description="Organise courses into categories. Active categories appear in the website catalog, filters and the student app."
        actions={<button onClick={() => open()} className="ed-btn ed-btn-filled ed-btn-sm"><Plus className="w-4 h-4" /> New category</button>}
      />
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <label className="relative flex-1">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" />
          <input className="ed-field !pl-10" placeholder="Search categories" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search categories" />
        </label>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`ed-btn ed-btn-sm ${filter === f ? 'ed-btn-ink' : 'ed-btn-outlined'}`}>
              {f === 'all' ? `All (${categories.length})` : f === 'active' ? 'Active' : 'Hidden'}
            </button>
          ))}
        </div>
      </div>

      <section className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-[#F7F9FC] text-[13px] uppercase tracking-wide text-[#64748B]">
              <tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">URL</th><th className="px-5 py-3 text-right">Courses</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {shown.map((c) => {
                const idx = categories.findIndex((x) => x.id === c.id);
                return (
                  <tr key={c.id}>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <button onClick={() => move(idx, -1)} disabled={!!query || filter !== 'all'} className="p-1 hover:bg-[#F1F5F9] rounded disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => move(idx, 1)} disabled={!!query || filter !== 'all'} className="p-1 hover:bg-[#F1F5F9] rounded disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#E8EFFB] shrink-0 flex items-center justify-center">
                          {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover" /> : <Tags className="w-5 h-5 text-[#004AAD]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#111827]">{c.name}</div>
                          <div className="text-[13px] text-[#64748B] line-clamp-1 max-w-[320px]">{c.description || 'No description'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[13.5px] text-[#475569] font-mono">/courses?category={c.slug}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">{c.courseCount}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 h-7 inline-flex items-center rounded-full text-[13px] font-semibold ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F1F5F9] text-[#475569]'}`}>{c.isActive ? 'Active' : 'Hidden'}</span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openAssign(c)} className="ed-btn ed-btn-text ed-btn-sm" title="Assign courses"><FolderInput className="w-4 h-4" /></button>
                      <button onClick={() => toggle(c)} className="ed-btn ed-btn-text ed-btn-sm" title={c.isActive ? 'Hide' : 'Show'}>{c.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      <button onClick={() => open(c)} className="ed-btn ed-btn-text ed-btn-sm" aria-label={`Edit ${c.name}`}><Pencil className="w-4 h-4" /></button>
                      <button
                        onClick={() => remove(c)}
                        className={`ed-btn ed-btn-text ed-btn-sm ${c.courseCount ? 'opacity-40 cursor-not-allowed' : '!text-rose-600'}`}
                        aria-label={`Delete ${c.name}`}
                        title={c.courseCount ? 'Move its courses to another category before deleting' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && shown.length === 0 && <EmptyState title={categories.length ? 'No categories match' : 'No categories yet'} body={categories.length ? 'Try another search or filter.' : 'Create your first category to organise courses.'} />}
          {loading && <div className="py-12 text-center text-[15px] text-[#64748B]">Loading categories…</div>}
        </div>
      </section>

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Category editor">
          <div className="fixed inset-0 bg-[#111827]/40" onClick={() => setForm(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[28px] shadow-2xl my-8 edufy-pop">
            <div className="flex items-center justify-between p-6 border-b border-[#EEF2F7]">
              <h2 className="font-display text-[24px] font-bold text-[#111827]">{form.id ? 'Edit category' : 'New category'}</h2>
              <button onClick={() => setForm(null)} className="w-10 h-10 rounded-full hover:bg-[#F1F5F9] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Name</span>
                <input className="ed-field mt-1.5" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slugTouched ? form.slug : toSlug(e.target.value) })} placeholder="e.g. Data Analytics" /></label>
              <label className="block"><span className="text-[15px] font-semibold text-[#111827]">URL name (slug)</span>
                <input className="ed-field mt-1.5 font-mono" maxLength={80} value={form.slug} onChange={(e) => setForm({ ...form, slug: toSlug(e.target.value), slugTouched: true })} />
                <span className="text-[12.5px] text-[#64748B]">Used in links like /courses?category={form.slug || 'data-analytics'}. Changing it updates every course in the category.</span></label>
              <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Description</span>
                <textarea rows={3} maxLength={500} className="ed-field mt-1.5 !h-auto py-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <div>
                <span className="text-[15px] font-semibold text-[#111827]">Image (optional)</span>
                <div className="mt-1.5 flex gap-2 items-center">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#E8EFFB] shrink-0">{form.imageUrl && <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />}</div>
                  <input className="ed-field" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
                  <label className="ed-btn ed-btn-tonal ed-btn-sm cursor-pointer shrink-0"><Upload className="w-4 h-4" />{uploading ? '…' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
                </div>
              </div>
              <label className="block"><span className="text-[15px] font-semibold text-[#111827]">Icon (shown when there’s no image)</span>
                <select className="ed-field mt-1.5" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                  {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select></label>
              <label className="flex items-center gap-3 text-[16px] font-medium text-[#111827] cursor-pointer">
                <input type="checkbox" className="w-5 h-5" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active (visible on the website and app)
              </label>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-[#EEF2F7]">
              <button onClick={() => setForm(null)} className="ed-btn ed-btn-outlined ed-btn-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="ed-btn ed-btn-filled ed-btn-sm">{saving ? 'Saving…' : 'Save category'}</button>
            </div>
          </div>
        </div>
      )}

      {assignFor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Assign courses">
          <div className="fixed inset-0 bg-[#111827]/40" onClick={() => setAssignFor(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[28px] shadow-2xl my-8 edufy-pop">
            <div className="flex items-center justify-between p-6 border-b border-[#EEF2F7]">
              <div>
                <h2 className="font-display text-[22px] font-bold text-[#111827]">Courses in “{assignFor.name}”</h2>
                <p className="text-[14px] text-[#64748B]">Tick courses to move them into this category. A course belongs to one category.</p>
              </div>
              <button onClick={() => setAssignFor(null)} className="w-10 h-10 rounded-full hover:bg-[#F1F5F9] flex items-center justify-center" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <input className="ed-field mb-3" placeholder="Search courses" value={courseQuery} onChange={(e) => setCourseQuery(e.target.value)} />
              <ul className="max-h-[50vh] overflow-y-auto divide-y divide-[#EEF2F7] border border-[#E2E8F0] rounded-2xl">
                {courses
                  .filter((c) => !courseQuery || c.title.toLowerCase().includes(courseQuery.toLowerCase()))
                  .map((c) => {
                    const inThis = c.categorySlug === assignFor.slug;
                    return (
                      <li key={c.id}>
                        <label className={`flex items-center gap-3 px-4 py-2.5 ${inThis ? 'bg-[#F7F9FC]' : 'cursor-pointer hover:bg-[#F7F9FC]'}`}>
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={selected.has(c.id)}
                            disabled={inThis}
                            onChange={() => {
                              const next = new Set(selected);
                              next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                              setSelected(next);
                            }}
                          />
                          <span className="flex-1 min-w-0 truncate text-[15px]">{c.title}</span>
                          <span className="text-[13px] text-[#64748B] shrink-0">{inThis ? 'In this category' : catName(c.categorySlug)}</span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
              <p className="mt-3 text-[13px] text-[#64748B]">To take a course out of this category, open the category you want it in and assign it there.</p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-[#EEF2F7]">
              <button onClick={() => setAssignFor(null)} className="ed-btn ed-btn-outlined ed-btn-sm">Cancel</button>
              <button onClick={saveAssign} disabled={saving} className="ed-btn ed-btn-filled ed-btn-sm">{saving ? 'Moving…' : 'Move selected courses'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
