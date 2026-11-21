import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Layers, PlayCircle, ShieldCheck } from 'lucide-react';
import { bundleService } from '../../services/api';
import { Bundle } from '../../types';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../components/common/CourseCard';
import { formatDuration } from '../../utils/courseUtils';
import { cdnImage, cdnSrcSet } from '../../lib/cdnImage';
import { displayInstructor } from '../../config/leadInstructor';
import { useGuestRedirect, useResumePurchase } from '../../hooks/usePurchaseFlow';

export const BundleDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const { initiateBundlePurchase, isProcessingPayment, isEnrolled } = useCartWishlist();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    bundleService.getBundle(id).then(setBundle).finally(() => setLoading(false));
  }, [id]);

  // Guests sign in first and come back here (?buy=1) to continue the bundle purchase once
  const toSignIn = useGuestRedirect();
  const purchaseBundle = async () =>
    bundle ? initiateBundlePurchase({ id: bundle.id, title: bundle.title, price: bundle.price, courseIds: bundle.courses.map((c) => c.id) }) : false;
  useResumePurchase('bundle', bundle?.slug, purchaseBundle, () => navigate('/student/courses'));

  if (loading) return <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-24 text-[#64748B]">Loading bundle…</div>;
  if (!bundle)
    return (
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-24 text-center">
        <h1 className="ed-display text-4xl">Bundle not found</h1>
        <Link to="/bundles" className="ed-btn ed-btn-tonal mt-6">See all bundles</Link>
      </div>
    );

  const saving = Math.max(0, bundle.coursesValue - bundle.price);
  const ownsAll = bundle.courses.length > 0 && bundle.courses.every((c) => isEnrolled(c.id));
  const totalHours = bundle.courses.reduce((s, c) => s + c.durationHours, 0);
  const totalLessons = bundle.courses.reduce((s, c) => s + c.totalLessons, 0);

  const buy = async () => {
    if (!currentUser) {
      toSignIn('bundle', bundle.slug);
      return;
    }
    const ok = await purchaseBundle();
    if (ok) navigate('/student/courses');
  };

  return (
    <div className="pb-24">
      <section className="bg-[#F7F9FC] border-b border-[#E2E8F0]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-10 pb-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <Link to="/bundles" className="text-[15px] text-[#64748B] hover:text-[#004AAD]">← All bundles</Link>
            <div className="mt-6 inline-flex items-center gap-2 h-8 px-3.5 rounded-full bg-[#F1EAFE] text-[14px] font-semibold text-[#5E17EB]">
              <Layers className="w-4 h-4" /> Bundle · {bundle.courses.length} courses
            </div>
            <h1 className="ed-display mt-5 text-[2.25rem] sm:text-[3rem] leading-[1.08]">{bundle.title}</h1>
            {bundle.subtitle && <p className="mt-5 text-[19px] leading-[1.65] text-[#475569]">{bundle.subtitle}</p>}
            <div className="mt-8 flex flex-wrap gap-6 text-[16px] text-[#475569]">
              <span className="inline-flex items-center gap-2"><Clock className="w-5 h-5 text-[#004AAD]" />{formatDuration(totalHours)} total</span>
              <span className="inline-flex items-center gap-2"><PlayCircle className="w-5 h-5 text-[#004AAD]" />{totalLessons} lessons</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#004AAD]" />Certificate for every course</span>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="bg-white rounded-[28px] shadow-xl p-6 sm:p-8">
              {bundle.thumbnail && <img src={cdnImage(bundle.thumbnail, 1280)} srcSet={cdnSrcSet(bundle.thumbnail, [640, 960, 1280])} sizes="(min-width: 1024px) 800px, 100vw" alt="" className="w-full aspect-[16/9] object-cover rounded-[18px] mb-6" />}
              <div className="flex items-baseline gap-3">
                <span className="font-display text-[36px] font-extrabold text-[#111827]">{formatPrice(bundle.price)}</span>
                {saving > 0 && <span className="text-[18px] text-[#94A3B8] line-through">₹{bundle.coursesValue.toLocaleString('en-IN')}</span>}
              </div>
              {saving > 0 && <div className="text-[16px] font-semibold text-[#5E17EB]">Save ₹{saving.toLocaleString('en-IN')} vs. buying separately</div>}
              {ownsAll ? (
                <Link to="/student/courses" className="ed-btn ed-btn-filled w-full mt-6">Go to my courses</Link>
              ) : (
                <button onClick={buy} disabled={isProcessingPayment} className="ed-btn ed-btn-filled w-full mt-6 disabled:opacity-60">
                  {isProcessingPayment ? 'Processing…' : 'Buy this bundle'}
                </button>
              )}
              <p className="mt-4 text-[14px] text-[#64748B] text-center">Secure payment with Razorpay · Lifetime access</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 mt-14 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7">
          {bundle.description && (
            <>
              <h2 className="font-display text-[28px] font-bold text-[#111827]">About this bundle</h2>
              <p className="mt-4 text-[18px] leading-[1.75] text-[#334155] whitespace-pre-line">{bundle.description}</p>
            </>
          )}
          <h2 className="mt-12 font-display text-[28px] font-bold text-[#111827]">What's included</h2>
          <ol className="mt-6 space-y-4">
            {bundle.courses.map((c, i) => (
              <li key={c.id}>
                <Link to={`/courses/${c.id}`} className="group grid grid-cols-[auto_120px_1fr] gap-5 items-center p-3 bg-white rounded-[22px] border border-[#E2E8F0] hover:shadow-md hover:border-transparent transition">
                  <span className="font-display text-[15px] font-bold text-[#94A3B8] w-7 text-center">{String(i + 1).padStart(2, '0')}</span>
                  <img src={cdnImage(c.thumbnail, 240)} alt="" className="w-[120px] aspect-[4/3] object-cover rounded-[14px]" />
                  <div className="min-w-0 pr-2">
                    <h3 className="font-display text-[19px] font-bold text-[#111827] group-hover:text-[#004AAD] line-clamp-2">{c.title}</h3>
                    <div className="mt-1 text-[15px] text-[#64748B]">{displayInstructor(c.instructor).name} · {c.level} · {formatDuration(c.durationHours)}</div>
                    {isEnrolled(c.id) && <div className="mt-1 text-[14px] font-semibold text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />You own this course</div>}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};
