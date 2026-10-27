import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { courseService } from '../../services/api';
import { Course, CourseSection, Lesson, CourseLevel, CourseStatus } from '../../types';
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  Upload,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Video,
  FileText,
  HelpCircle,
  Paperclip,
  Check,
  X,
  Play,
  IndianRupee,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

const CATEGORIES = [
  'Web Development',
  'Artificial Intelligence',
  'Data Science & Analytics',
  'UI/UX Design',
  'Ethical Hacking & Cyber Security',
  'Mobile App Development',
  'Cloud Computing & DevOps',
  'Digital Marketing',
  'Business & Entrepreneurship',
];

const LEVELS: CourseLevel[] = ['All Levels', 'Beginner', 'Intermediate', 'Advanced'];

export const CourseCreatorPage: React.FC = () => {
  const { currentUser, role } = useAuth();
  const { showToast } = useCartWishlist();
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const courseIdParam = params.id || searchParams.get('id');

  const [activeTab, setActiveTab] = useState<'details' | 'learners' | 'curriculum' | 'media' | 'pricing'>('details');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Core Course Details
  const [courseId, setCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [level, setLevel] = useState<CourseLevel>('All Levels');
  const [language, setLanguage] = useState('English');
  const [price, setPrice] = useState('999');
  const [originalPrice, setOriginalPrice] = useState('2499');
  const [isFree, setIsFree] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [promoVideoUrl, setPromoVideoUrl] = useState('');
  const [status, setStatus] = useState<CourseStatus>('draft');
  const [isPublished, setIsPublished] = useState(false);

  // Dynamic Learner Outcomes
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>([
    'Build production-ready applications with modern industry workflows',
    'Master core architecture patterns and best practices',
  ]);
  const [requirements, setRequirements] = useState<string[]>([
    'Basic computer literacy and enthusiasm to learn',
  ]);
  const [targetAudience, setTargetAudience] = useState<string[]>([
    'Aspiring software engineers and career changers',
    'Professionals looking to upskill in high-demand tech stacks',
  ]);

  // Curriculum Sections & Lessons
  const [curriculum, setCurriculum] = useState<CourseSection[]>([
    {
      id: 'sec-1',
      title: 'Introduction & Environment Setup',
      order: 1,
      lessons: [
        {
          id: 'les-1',
          title: 'Course Welcome & Learning Path Roadmap',
          durationMinutes: 8,
          type: 'video',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          isFreePreview: true,
          contentText: 'Welcome to this comprehensive masterclass. Let us review what we will achieve together.',
        },
      ],
    },
  ]);

  // Load existing course if editing
  useEffect(() => {
    if (courseIdParam) {
      setLoading(true);
      courseService
        .getCourseById(courseIdParam)
        .then((c) => {
          if (c) {
            setCourseId(c.id);
            setTitle(c.title);
            setSubtitle(c.subtitle || '');
            setDescription(c.description || '');
            setCategory(c.category || CATEGORIES[0]);
            setLevel(c.level || 'All Levels');
            setLanguage(c.language || 'English');
            setPrice(c.price.toString());
            setOriginalPrice(c.originalPrice ? c.originalPrice.toString() : (c.price * 1.5).toString());
            setIsFree(c.price === 0);
            setThumbnailUrl(c.thumbnail || '');
            setPromoVideoUrl(c.previewVideoUrl || '');
            setStatus(c.status || (c.isPublished ? 'published' : 'draft'));
            setIsPublished(!!c.isPublished);
            if (c.learningOutcomes?.length) setLearningOutcomes(c.learningOutcomes);
            if (c.requirements?.length) setRequirements(c.requirements);
            if (c.targetAudience?.length) setTargetAudience(c.targetAudience);
            if (c.curriculum?.length) setCurriculum(c.curriculum);
          } else {
            showToast('Course not found in database.', 'error');
          }
        })
        .catch((err) => {
          console.error('Error fetching course:', err);
          showToast('Failed to load course details.', 'error');
        })
        .finally(() => setLoading(false));
    }
  }, [courseIdParam]);

  // Add / Remove dynamic outcome items
  const addOutcome = () => setLearningOutcomes([...learningOutcomes, '']);
  const updateOutcome = (idx: number, val: string) => {
    const next = [...learningOutcomes];
    next[idx] = val;
    setLearningOutcomes(next);
  };
  const removeOutcome = (idx: number) => setLearningOutcomes(learningOutcomes.filter((_, i) => i !== idx));

  // Add / Remove requirements
  const addRequirement = () => setRequirements([...requirements, '']);
  const updateRequirement = (idx: number, val: string) => {
    const next = [...requirements];
    next[idx] = val;
    setRequirements(next);
  };
  const removeRequirement = (idx: number) => setRequirements(requirements.filter((_, i) => i !== idx));

  // Add / Remove target audience
  const addAudience = () => setTargetAudience([...targetAudience, '']);
  const updateAudience = (idx: number, val: string) => {
    const next = [...targetAudience];
    next[idx] = val;
    setTargetAudience(next);
  };
  const removeAudience = (idx: number) => setTargetAudience(targetAudience.filter((_, i) => i !== idx));

  // Curriculum handlers
  const addSection = () => {
    const newSec: CourseSection = {
      id: `sec-temp-${Date.now()}`,
      title: `Section ${curriculum.length + 1}: Core Concepts`,
      order: curriculum.length + 1,
      lessons: [
        {
          id: `les-temp-${Date.now()}`,
          title: 'Lesson 1: Overview & Objectives',
          durationMinutes: 10,
          type: 'video',
          isFreePreview: false,
        },
      ],
    };
    setCurriculum([...curriculum, newSec]);
  };

  const updateSectionTitle = (sIdx: number, val: string) => {
    const next = [...curriculum];
    next[sIdx].title = val;
    setCurriculum(next);
  };

  const removeSection = (sIdx: number) => {
    if (curriculum.length <= 1) {
      showToast('Course must have at least one curriculum section.', 'warning');
      return;
    }
    setCurriculum(curriculum.filter((_, i) => i !== sIdx));
  };

  const addLesson = (sIdx: number) => {
    const next = [...curriculum];
    const currentLessons = next[sIdx].lessons || [];
    currentLessons.push({
      id: `les-temp-${Date.now()}`,
      title: `Lesson ${currentLessons.length + 1}: Deep Dive`,
      durationMinutes: 12,
      type: 'video',
      isFreePreview: false,
    });
    next[sIdx].lessons = currentLessons;
    setCurriculum(next);
  };

  const updateLesson = (sIdx: number, lIdx: number, fields: Partial<Lesson>) => {
    const next = [...curriculum];
    next[sIdx].lessons[lIdx] = { ...next[sIdx].lessons[lIdx], ...fields };
    setCurriculum(next);
  };

  const removeLesson = (sIdx: number, lIdx: number) => {
    const next = [...curriculum];
    next[sIdx].lessons = next[sIdx].lessons.filter((_, i) => i !== lIdx);
    setCurriculum(next);
  };

  // Upload handler for thumbnails, videos, resources
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    bucket: 'course-thumbnails' | 'course-videos' | 'course-materials',
    onSuccess: (url: string, path: string) => void,
    uploadKey: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(uploadKey);
      const res = await courseService.uploadMedia(file, bucket);
      onSuccess(res.url, res.storageAssetPath);
      showToast(`File "${file.name}" uploaded to ${bucket}!`, 'success');
    } catch (err: any) {
      console.error('Upload failed:', err);
      showToast(err.message || 'File upload failed. Please try again.', 'error');
    } finally {
      setUploading(null);
    }
  };

  // Calculate totals
  const totalLessons = curriculum.reduce((sum, s) => sum + (s.lessons?.length || 0), 0);
  const totalMinutes = curriculum.reduce(
    (sum, s) => sum + (s.lessons?.reduce((lSum, l) => lSum + (Number(l.durationMinutes) || 0), 0) || 0),
    0
  );
  const durationHours = Math.max(0.5, Math.round((totalMinutes / 60) * 10) / 10);

  // Save or Publish Action
  const handleSaveCourse = async (publishLive = false, submitForReview = false) => {
    if (!title.trim()) {
      showToast('Please enter a course title.', 'error');
      setActiveTab('details');
      return;
    }

    if (!thumbnailUrl.trim()) {
      showToast('Please provide a course thumbnail image.', 'warning');
      setActiveTab('media');
      return;
    }

    if (totalLessons === 0) {
      showToast('Please add at least one lesson to your curriculum.', 'warning');
      setActiveTab('curriculum');
      return;
    }

    try {
      setSaving(true);

      const coursePayload: Partial<Course> = {
        id: courseId || undefined,
        title: title.trim(),
        subtitle: subtitle.trim() || 'Master practical skills with step-by-step guidance.',
        description: description.trim() || 'A comprehensive, hands-on masterclass crafted for learners.',
        category,
        level,
        language,
        price: isFree ? 0 : parseFloat(price) || 0,
        originalPrice: isFree ? 0 : parseFloat(originalPrice) || (parseFloat(price) * 1.5),
        thumbnail: thumbnailUrl,
        previewVideoUrl: promoVideoUrl,
        learningOutcomes: learningOutcomes.filter((o) => o.trim().length > 0),
        requirements: requirements.filter((r) => r.trim().length > 0),
        targetAudience: targetAudience.filter((a) => a.trim().length > 0),
        isPublished: role === 'admin' ? publishLive : false,
        status: role === 'admin'
          ? (publishLive ? 'published' : 'draft')
          : (submitForReview ? 'pending_review' : 'draft'),
      };

      const result = await courseService.saveCourse(coursePayload, curriculum, submitForReview);

      setCourseId(result.courseId);
      setIsPublished(result.isPublished);
      setStatus(result.status as CourseStatus);

      showToast(result.message, 'success');

      // If user is admin or published, offer navigation back to courses
      if (publishLive || submitForReview) {
        setTimeout(() => {
          navigate(role === 'admin' ? '/admin/courses' : '/instructor/courses');
        }, 1200);
      }
    } catch (err: any) {
      console.error('Course save failed:', err);
      showToast(err.message || 'Failed to save course. Please check inputs and retry.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-10 h-10 border-4 border-[#004AAD] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[#64748B]">Loading course details from Supabase...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to={role === 'admin' ? '/admin/courses' : '/instructor/courses'}
            className="p-2 text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9] rounded-lg transition-colors"
            title="Back to Catalog"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-[#111827]">
                {courseId ? 'Edit Masterclass' : 'Udemy-Style Course Creator'}
              </h1>
              <span
                className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full ${
                  isPublished || status === 'published'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'pending_review'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {isPublished || status === 'published'
                  ? 'Live on Marketplace'
                  : status === 'pending_review'
                  ? 'Pending Admin Review'
                  : 'Draft Mode'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              {totalLessons} lessons · {durationHours} hours estimated curriculum
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-[#111827] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4 text-[#004AAD]" />
            <span>Preview</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveCourse(false, false)}
            className="px-4 py-2 text-xs font-bold text-[#004AAD] bg-[#EBF3FF] hover:bg-[#D9E9FF] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          {role === 'admin' ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveCourse(!isPublished, false)}
              className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors flex items-center gap-1.5 shadow ${
                isPublished
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              } disabled:opacity-50`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isPublished ? 'Unpublish Course' : 'Publish to Marketplace'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || status === 'pending_review'}
              onClick={() => handleSaveCourse(false, true)}
              className="px-4 py-2 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors flex items-center gap-1.5 shadow disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{status === 'pending_review' ? 'Submitted for Review' : 'Submit for Review'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Udemy-Style Step Navigation Tabs */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-1.5 flex flex-wrap gap-1 shadow-xs">
        {[
          { key: 'details', label: '1. Course Details', icon: Layers },
          { key: 'learners', label: '2. Intended Learners', icon: Sparkles },
          { key: 'curriculum', label: '3. Curriculum Builder', icon: Video },
          { key: 'media', label: '4. Course Media', icon: Upload },
          { key: 'pricing', label: '5. Pricing & Publish', icon: IndianRupee },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#004AAD] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Course Details */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-6 shadow-xs">
          <div>
            <h2 className="font-display text-base font-bold text-[#111827]">Course Overview</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Enter essential course information that helps prospective students discover your content.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#111827] mb-1">
                Course Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Complete Web Development Bootcamp 2026"
                className="w-full px-3.5 py-2.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] focus:bg-white text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111827] mb-1">
                Course Subtitle <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Master HTML5, CSS3, modern JavaScript, React, Node.js, and build 10 portfolio projects."
                className="w-full px-3.5 py-2.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] focus:bg-white text-[#111827]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111827] mb-1">
                Detailed Course Description
              </label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what students will accomplish, key highlights, project demos, and industry best practices..."
                className="w-full px-3.5 py-2.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] focus:bg-white text-[#111827]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">Primary Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">Difficulty Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as CourseLevel)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
                >
                  {LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1">Instruction Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi / Hinglish</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setActiveTab('learners')}
              className="px-5 py-2.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors"
            >
              Continue to Intended Learners &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Intended Learners */}
      {activeTab === 'learners' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-6 shadow-xs">
          <div>
            <h2 className="font-display text-base font-bold text-[#111827]">Intended Learners</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Define the clear learning outcomes, prerequisites, and target audience for prospective students.
            </p>
          </div>

          {/* Learning Outcomes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#111827]">
                What will students learn in your course? (Learning Outcomes)
              </label>
              <button
                type="button"
                onClick={addOutcome}
                className="text-xs text-[#004AAD] hover:underline flex items-center gap-1 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Outcome</span>
              </button>
            </div>
            {learningOutcomes.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateOutcome(idx, e.target.value)}
                  placeholder={`e.g. Master fundamental concepts and build production full-stack systems`}
                  className="flex-1 px-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
                />
                <button
                  type="button"
                  onClick={() => removeOutcome(idx)}
                  className="p-2 text-[#64748B] hover:text-rose-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Prerequisites */}
          <div className="space-y-3 pt-4 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#111827]">
                Course Prerequisites & Requirements
              </label>
              <button
                type="button"
                onClick={addRequirement}
                className="text-xs text-[#004AAD] hover:underline flex items-center gap-1 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Prerequisite</span>
              </button>
            </div>
            {requirements.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateRequirement(idx, e.target.value)}
                  placeholder="e.g. A laptop with internet connection and VS Code installed"
                  className="flex-1 px-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
                />
                <button
                  type="button"
                  onClick={() => removeRequirement(idx)}
                  className="p-2 text-[#64748B] hover:text-rose-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Target Audience */}
          <div className="space-y-3 pt-4 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#111827]">
                Who is this course for? (Target Audience)
              </label>
              <button
                type="button"
                onClick={addAudience}
                className="text-xs text-[#004AAD] hover:underline flex items-center gap-1 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Target Profile</span>
              </button>
            </div>
            {targetAudience.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateAudience(idx, e.target.value)}
                  placeholder="e.g. Beginners looking to break into software development"
                  className="flex-1 px-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827]"
                />
                <button
                  type="button"
                  onClick={() => removeAudience(idx)}
                  className="p-2 text-[#64748B] hover:text-rose-600 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#111827]"
            >
              &larr; Back to Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('curriculum')}
              className="px-5 py-2.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors"
            >
              Continue to Curriculum Builder &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Curriculum Builder */}
      {activeTab === 'curriculum' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#111827]">Curriculum Architecture</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Organize your course into structured sections and individual lessons with video, articles, and downloadable resources.
              </p>
            </div>
            <button
              type="button"
              onClick={addSection}
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Section</span>
            </button>
          </div>

          <div className="space-y-6">
            {curriculum.map((section, sIdx) => (
              <div key={section.id || sIdx} className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 space-y-4">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-black text-[#004AAD] bg-[#EBF3FF] px-2 py-0.5 rounded">
                      Sec {sIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                      placeholder="Section Title"
                      className="flex-1 px-3 py-1.5 text-xs font-bold text-[#111827] bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD]"
                    />
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => addLesson(sIdx)}
                      className="px-2.5 py-1 text-xs font-bold text-[#004AAD] bg-white border border-[#004AAD]/30 hover:bg-[#EBF3FF] rounded transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Lesson</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(sIdx)}
                      className="p-1.5 text-[#64748B] hover:text-rose-600 rounded"
                      title="Delete Section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Lessons in Section */}
                <div className="space-y-3 pl-2 sm:pl-4">
                  {section.lessons?.map((lesson, lIdx) => (
                    <div
                      key={lesson.id || lIdx}
                      className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 space-y-3 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[11px] font-semibold text-[#64748B]">
                            {sIdx + 1}.{lIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={lesson.title}
                            onChange={(e) => updateLesson(sIdx, lIdx, { title: e.target.value })}
                            placeholder="Lesson Title"
                            className="flex-1 px-2.5 py-1 text-xs font-semibold text-[#111827] border border-transparent hover:border-[#CBD5E1] focus:border-[#004AAD] rounded transition-all"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Duration */}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={lesson.durationMinutes}
                              onChange={(e) => updateLesson(sIdx, lIdx, { durationMinutes: parseInt(e.target.value, 10) || 5 })}
                              className="w-14 px-1.5 py-1 text-xs text-center border border-[#CBD5E1] rounded focus:outline-none"
                            />
                            <span className="text-[11px] text-[#64748B]">min</span>
                          </div>

                          {/* Free Preview Toggle */}
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111827] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!lesson.isFreePreview}
                              onChange={(e) => updateLesson(sIdx, lIdx, { isFreePreview: e.target.checked })}
                              className="rounded border-[#CBD5E1] text-[#004AAD] focus:ring-[#004AAD]"
                            />
                            <span>Free Preview</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => removeLesson(sIdx, lIdx)}
                            className="p-1 text-[#64748B] hover:text-rose-600 rounded"
                            title="Remove Lesson"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Lesson Content Tabs & Upload Controls */}
                      <div className="pt-2 border-t border-[#F1F5F9] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Video upload or URL */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-[#64748B] flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Video className="w-3 h-3 text-[#004AAD]" />
                              Video Stream Source
                            </span>
                            {lesson.videoUrl && (
                              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> Attached
                              </span>
                            )}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={lesson.videoUrl || ''}
                              onChange={(e) => updateLesson(sIdx, lIdx, { videoUrl: e.target.value })}
                              placeholder="Direct Video URL (.mp4 or streaming)"
                              className="flex-1 px-2.5 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded focus:outline-none focus:border-[#004AAD]"
                            />
                            <label className="px-2.5 py-1.5 bg-[#EBF3FF] hover:bg-[#D9E9FF] text-[#004AAD] font-bold rounded cursor-pointer shrink-0 transition-colors">
                              {uploading === `video-${sIdx}-${lIdx}` ? 'Uploading...' : 'Upload'}
                              <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                disabled={uploading !== null}
                                onChange={(e) =>
                                  handleFileUpload(
                                    e,
                                    'course-videos',
                                    (url, path) => updateLesson(sIdx, lIdx, { videoUrl: url, storageAssetPath: path }),
                                    `video-${sIdx}-${lIdx}`
                                  )
                                }
                              />
                            </label>
                          </div>
                        </div>

                        {/* Article or Supplementary Notes */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-[#64748B] flex items-center gap-1">
                            <FileText className="w-3 h-3 text-[#004AAD]" />
                            <span>Lesson Description & Markdown Notes</span>
                          </label>
                          <input
                            type="text"
                            value={lesson.contentText || ''}
                            onChange={(e) => updateLesson(sIdx, lIdx, { contentText: e.target.value })}
                            placeholder="Key takeaways, terminal commands, or study notes..."
                            className="w-full px-2.5 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded focus:outline-none focus:border-[#004AAD]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('learners')}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#111827]"
            >
              &larr; Back to Learners
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('media')}
              className="px-5 py-2.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors"
            >
              Continue to Course Media &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Course Media */}
      {activeTab === 'media' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-6 shadow-xs">
          <div>
            <h2 className="font-display text-base font-bold text-[#111827]">Course Media & Visual Assets</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Upload an engaging course thumbnail and promotional video to attract prospective learners.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Thumbnail Upload */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#111827]">
                Course Thumbnail Image <span className="text-rose-500">*</span>
              </label>
              <div className="aspect-video bg-[#F8FAFC] border-2 border-dashed border-[#CBD5E1] rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 relative group">
                {thumbnailUrl ? (
                  <>
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="px-3 py-1.5 bg-white text-xs font-bold text-[#111827] rounded-lg cursor-pointer shadow">
                        Change Image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            handleFileUpload(
                              e,
                              'course-thumbnails',
                              (url) => setThumbnailUrl(url),
                              'thumb'
                            )
                          }
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="text-center space-y-2">
                    <Upload className="w-8 h-8 text-[#64748B] mx-auto" />
                    <p className="text-xs font-semibold text-[#111827]">
                      {uploading === 'thumb' ? 'Uploading to Supabase...' : 'Upload 16:9 Thumbnail Image'}
                    </p>
                    <p className="text-[11px] text-[#64748B]">PNG, JPG, or WEBP up to 50MB</p>
                    <label className="inline-block mt-2 px-3 py-1.5 text-xs font-bold text-white bg-[#004AAD] rounded-lg cursor-pointer shadow-xs hover:bg-[#003B8B]">
                      Browse Files
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleFileUpload(
                            e,
                            'course-thumbnails',
                            (url) => setThumbnailUrl(url),
                            'thumb'
                          )
                        }
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Direct URL input fallback */}
              <div>
                <label className="block text-[11px] text-[#64748B] mb-1">Or paste direct image URL</label>
                <input
                  type="text"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD]"
                />
              </div>
            </div>

            {/* Promotional Video */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#111827]">
                Promotional Teaser Video
              </label>
              <div className="aspect-video bg-[#F8FAFC] border-2 border-dashed border-[#CBD5E1] rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 relative">
                {promoVideoUrl ? (
                  <video
                    src={promoVideoUrl}
                    controls
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <Video className="w-8 h-8 text-[#64748B] mx-auto" />
                    <p className="text-xs font-semibold text-[#111827]">
                      {uploading === 'promo' ? 'Uploading Video...' : 'Upload Free Promotional Video'}
                    </p>
                    <p className="text-[11px] text-[#64748B]">MP4 or WEBM video format</p>
                    <label className="inline-block mt-2 px-3 py-1.5 text-xs font-bold text-white bg-[#004AAD] rounded-lg cursor-pointer shadow-xs hover:bg-[#003B8B]">
                      Browse Video
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) =>
                          handleFileUpload(
                            e,
                            'course-videos',
                            (url) => setPromoVideoUrl(url),
                            'promo'
                          )
                        }
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Direct URL input fallback */}
              <div>
                <label className="block text-[11px] text-[#64748B] mb-1">Or paste direct promo video URL</label>
                <input
                  type="text"
                  value={promoVideoUrl}
                  onChange={(e) => setPromoVideoUrl(e.target.value)}
                  placeholder="https://commondatastorage.googleapis.com/.../sample.mp4"
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD]"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('curriculum')}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#111827]"
            >
              &larr; Back to Curriculum
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className="px-5 py-2.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors"
            >
              Continue to Pricing & Publish &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Tab 5: Pricing & Publication */}
      {activeTab === 'pricing' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-6 shadow-xs">
          <div>
            <h2 className="font-display text-base font-bold text-[#111827]">Pricing & Publication Review</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Set your enrollment fee in Indian Rupees (₹) and finalize your submission for administrator review.
            </p>
          </div>

          <div className="space-y-5 max-w-xl">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="free-toggle"
                checked={isFree}
                onChange={(e) => {
                  setIsFree(e.target.checked);
                  if (e.target.checked) {
                    setPrice('0');
                    setOriginalPrice('0');
                  } else {
                    setPrice('999');
                    setOriginalPrice('2499');
                  }
                }}
                className="w-4 h-4 rounded border-[#CBD5E1] text-[#004AAD] focus:ring-[#004AAD]"
              />
              <label htmlFor="free-toggle" className="text-xs font-bold text-[#111827] cursor-pointer">
                Offer this course completely free of charge to all learners
              </label>
            </div>

            {!isFree && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#111827] mb-1">
                    Student Price (₹ INR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#64748B]">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="999"
                      className="w-full pl-7 pr-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827] font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111827] mb-1">
                    Original MSRP Price (₹ INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#64748B]">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      placeholder="2499"
                      className="w-full pl-7 pr-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#004AAD] text-[#111827] font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Checklist */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5 text-xs">
              <h4 className="font-bold text-[#111827] mb-1">Pre-flight Quality Checklist</h4>
              <div className="flex items-center gap-2 text-slate-700">
                {title.length >= 10 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span>Course title has at least 10 characters</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                {thumbnailUrl ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span>Promotional thumbnail is uploaded</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                {totalLessons >= 1 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span>Curriculum contains at least 1 lesson ({totalLessons} added)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveCourse(false, false)}
                className="px-4 py-2.5 text-xs font-bold text-[#004AAD] bg-[#EBF3FF] hover:bg-[#D9E9FF] rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Draft</span>
              </button>

              {role === 'admin' ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveCourse(true, false)}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Publish to Marketplace</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving || status === 'pending_review'}
                  onClick={() => handleSaveCourse(false, true)}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors flex items-center gap-1.5 shadow"
                >
                  <Send className="w-4 h-4" />
                  <span>{status === 'pending_review' ? 'In Review by Admin' : 'Submit for Admin Review'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student View Live Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-[#E2E8F0] my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#004AAD]" />
                <h3 className="font-display text-sm font-bold text-[#111827]">
                  Student Marketplace Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#111827] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Course Card Preview */}
            <div className="space-y-4">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 shadow">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-xs">
                    No Thumbnail Uploaded
                  </div>
                )}
                {promoVideoUrl && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/90 text-[#004AAD] flex items-center justify-center shadow-lg">
                      <Play className="w-6 h-6 ml-0.5" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#004AAD] uppercase tracking-wider bg-[#EBF3FF] px-2 py-0.5 rounded">
                  {category}
                </span>
                <h2 className="font-display text-xl font-bold text-[#111827] mt-1.5">{title || 'Untitled Course'}</h2>
                <p className="text-xs text-[#64748B] mt-1">{subtitle}</p>
              </div>

              <div className="flex items-center gap-4 text-xs text-[#64748B] pt-2 border-t border-[#E2E8F0]">
                <span>Level: <strong className="text-[#111827]">{level}</strong></span>
                <span>Language: <strong className="text-[#111827]">{language}</strong></span>
                <span>Lessons: <strong className="text-[#111827]">{totalLessons}</strong></span>
                <span>Duration: <strong className="text-[#111827]">{durationHours}h</strong></span>
              </div>

              <div className="p-4 bg-[#F8FAFC] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#64748B]">Enrollment Price</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-black text-[#111827]">
                      {isFree ? 'FREE' : `₹${parseFloat(price || '0').toLocaleString('en-IN')}`}
                    </span>
                    {!isFree && originalPrice && (
                      <span className="text-xs text-[#94A3B8] line-through">
                        ₹{parseFloat(originalPrice).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#004AAD] rounded-lg shadow"
                >
                  Enroll Now
                </button>
              </div>

              {/* Learning Outcomes Preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#111827]">What you will learn:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#334155]">
                  {learningOutcomes.map((o, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{o}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
