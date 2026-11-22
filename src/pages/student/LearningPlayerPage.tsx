import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courseService, certificateService, storageService } from '../../services/api';
import { Course, Lesson, CourseSection, Certificate } from '../../types';
import { useCourseProgress } from '../../context/CourseProgressContext';
import { AdiloPlayer } from '../../components/student/AdiloPlayer';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { useStartCoursePurchase } from '../../hooks/usePurchaseFlow';
import { CertificateFrame } from '../../components/certificate/CertificateDocument';
import { siteUrl } from '../../lib/siteUrl';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  BookOpen,
  FileText,
  Award,
  Download,
  Plus,
  ArrowLeft,
  HelpCircle,
  MessageSquare,
  Lock,
  ExternalLink,
  X,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '../../utils/currency';
import { coursePath } from '../../seo/seoConfig';
import { UpNextOverlay } from '../../components/student/UpNextOverlay';
import { AUTOPLAY_COUNTDOWN_SECONDS, lessonToAutoplay, readAutoplayPref, writeAutoplayPref } from '../../lib/autoplayNext';

export const LearningPlayerPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'qa' | 'resources'>('overview');
  const [newNoteText, setNewNoteText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('1.0x');
  const [isMuted, setIsMuted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(35); // simulated percent
  const [claimedCert, setClaimedCert] = useState<Certificate | null>(null);
  const [claimingCert, setClaimingCert] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  // Autoplay next lesson: learner preference, the "Up next" countdown, and the lesson whose video should start itself
  const [autoAdvance, setAutoAdvance] = useState<boolean>(() => readAutoplayPref());
  const [upNext, setUpNext] = useState<Lesson | null>(null);
  const [autoPlayLessonId, setAutoPlayLessonId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { isEnrolled, isProcessingPayment, showToast } = useCartWishlist();
  const startPurchase = useStartCoursePurchase();

  const {
    isLessonCompleted,
    toggleLessonComplete,
    markLessonComplete,
    setLessonCompletedLocal,
    getCourseProgressPercent,
    addNote,
    getNotes,
  } = useCourseProgress();

  useEffect(() => {
    if (!courseId) return;
    courseService.getCourseById(courseId).then((data) => {
      setCourse(data);
      if (data && data.curriculum.length > 0) {
        // Expand first section
        setExpandedSections({ [data.curriculum[0].id]: true });
        // Set first lesson
        if (data.curriculum[0].lessons.length > 0) {
          setCurrentLesson(data.curriculum[0].lessons[0]);
        }
      }
    });
  }, [courseId]);

  // Issue the certificate automatically as soon as every lesson is complete (the API re-checks
  // enrolment and completion, and returns the existing certificate instead of issuing twice).
  const autoClaimedFor = useRef<string | null>(null);
  const certProgress = course ? getCourseProgressPercent(course.id, course.totalLessons) : 0;
  const certEnrolled = course ? isEnrolled(course.id) : false;
  useEffect(() => {
    if (!course || certProgress < 100 || !certEnrolled || autoClaimedFor.current === course.id) return;
    autoClaimedFor.current = course.id;
    certificateService.claimCertificate(course.id).then((res) => {
      if (res.success && res.certificate) {
        setClaimedCert(res.certificate);
        if (!res.alreadyIssued) {
          setShowCertModal(true);
          showToast('Your certificate is ready.', 'success');
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, certProgress, certEnrolled]);

  if (!course || !currentLesson) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm">
        Loading interactive player...
      </div>
    );
  }

  // Find all lessons in a flat list for next/previous navigation
  const allLessons: { lesson: Lesson; sectionId: string; sectionTitle: string }[] = [];
  course.curriculum.forEach((section) => {
    section.lessons.forEach((l) => {
      allLessons.push({ lesson: l, sectionId: section.id, sectionTitle: section.title });
    });
  });

  const currentIndex = allLessons.findIndex((item) => item.lesson.id === currentLesson.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1].lesson : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1].lesson : null;

  const currentLessonCompleted = isLessonCompleted(course.id, currentLesson.id);
  const overallProgress = getCourseProgressPercent(course.id, course.totalLessons);
  const notes = getNotes(course.id);

  const userIsEnrolled = course ? isEnrolled(course.id) : false;
  const canAccessCurrentLesson = userIsEnrolled || currentLesson.isFreePreview;

  const handleClaimCertificate = async () => {
    if (!course) return;
    setClaimingCert(true);
    const res = await certificateService.claimCertificate(course.id);
    setClaimingCert(false);
    if (res.success && res.certificate) {
      setClaimedCert(res.certificate);
      setShowCertModal(true);
    } else {
      showToast(res.error || 'Complete every lesson to get your certificate.', 'error');
    }
  };

  const handleDownloadResource = async (storagePath: string, filename: string) => {
    if (!course) return;
    showToast('Preparing your download…', 'info');
    const signedUrl = await storageService.getDownloadUrl(course.id, storagePath);
    if (signedUrl) {
      showToast('Resource download started', 'success');
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      showToast('Download unavailable — you may not have access to this resource.', 'error');
    }
  };

  /** Opens a lesson (and its section in the curriculum). `autoplay`: start its video by itself. */
  const openLesson = (lesson: Lesson, autoplay = false) => {
    setUpNext(null);
    setAutoPlayLessonId(autoplay ? lesson.id : null);
    setCurrentLesson(lesson);
    const sectionId = allLessons.find((item) => item.lesson.id === lesson.id)?.sectionId;
    if (sectionId) setExpandedSections((prev) => ({ ...prev, [sectionId]: true }));
  };

  const handleNextLesson = () => {
    if (nextLesson) {
      openLesson(nextLesson);
    }
  };

  const handlePrevLesson = () => {
    if (prevLesson) {
      openLesson(prevLesson);
    }
  };

  // The video finished: offer the next lesson with a short countdown (when autoplay is on and it can be opened)
  const handleVideoEnded = () => {
    const next = lessonToAutoplay(
      allLessons.map((item) => item.lesson),
      currentLesson.id,
      { enabled: autoAdvance, enrolled: userIsEnrolled }
    );
    if (next) setUpNext(next);
  };

  const toggleAutoAdvance = () => {
    const on = !autoAdvance;
    setAutoAdvance(on);
    writeAutoplayPref(on);
    if (!on) setUpNext(null);
  };

  const handleToggleComplete = () => {
    if ((currentLesson.adiloFileId || currentLesson.adiloEmbedUrl) && !isLessonCompleted(course.id, currentLesson.id)) {
      showToast('Video lessons complete automatically after you watch at least 90% of the video.', 'info');
      return;
    }
    toggleLessonComplete(course.id, currentLesson.id);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    addNote(course.id, currentLesson.id, newNoteText);
    setNewNoteText('');
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col">
      {/* Top Bar for Learning Player */}
      <header className="h-14 bg-[#111827] text-white px-4 flex items-center justify-between shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link
            to="/student"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <span className="text-slate-600">|</span>
          <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-md">
            {course.title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-slate-400">Course Progress:</span>
            <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#5271FF] h-full rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
            <span className="font-bold text-blue-400 tabular-nums">{overallProgress}%</span>
          </div>

          <Link
            to={coursePath(course)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Course Details
          </Link>
        </div>
      </header>

      {/* Main Player Body (Video Area on Left/Center, Curriculum Accordion on Right) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Column: Player + Details Tabs */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Video Container */}
          <div className="relative bg-black aspect-video w-full max-h-[580px] flex items-center justify-center overflow-hidden group">
            {!canAccessCurrentLesson ? (
              <div className="text-center p-8 text-white space-y-4 max-w-md bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700 mx-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="font-display text-xl font-bold">Enrollment Required</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This lecture is exclusive to enrolled learners. Unlock instant lifetime access to all {course.totalLessons} curriculum lectures, interactive quizzes, and verifiable credentials.
                </p>
                <button
                  onClick={() => startPurchase(course)}
                  disabled={isProcessingPayment}
                  className="px-6 py-3 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full transition-colors shadow-lg flex items-center justify-center gap-2 mx-auto"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isProcessingPayment ? 'Processing...' : `Enroll Now via Razorpay (${formatINR(course.price)})`}</span>
                </button>
              </div>
            ) : currentLesson.type === 'quiz' ? (
              <div className="text-center p-8 text-white space-y-4 max-w-md">
                <div className="w-14 h-14 rounded-2xl bg-[#5E17EB]/20 border border-[#5E17EB]/40 text-[#5E17EB] flex items-center justify-center mx-auto">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="font-display text-xl font-bold">Module Assessment Quiz</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Test your understanding of the concepts covered in this module. Score 75% or higher to unlock the next segment.
                </p>
                <button
                  onClick={() => navigate(`/learn/${course.id}/quiz/${currentLesson.quizId || 'quiz-fs-1'}`)}
                  className="px-6 py-3 text-xs font-bold text-white bg-[#5E17EB] hover:bg-purple-700 rounded-xl transition-colors shadow-lg"
                >
                  Start Module Quiz Now
                </button>
              </div>
            ) : currentLesson.adiloFileId || currentLesson.adiloEmbedUrl ? (
              <AdiloPlayer
                key={currentLesson.id}
                lessonId={currentLesson.id}
                title={currentLesson.title}
                autoPlay={autoPlayLessonId === currentLesson.id}
                onEnded={handleVideoEnded}
                onCompleted={() => {
                  setLessonCompletedLocal(course.id, currentLesson.id);
                  showToast('Lesson complete — great work!', 'success');
                }}
              />
            ) : (
              <>
                {/* Simulated High-Res Video Canvas */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-center items-center p-8 text-center select-none">
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mb-4 shadow-xl cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                    {course.category} · Module Lecture
                  </div>
                  <h2 className="font-display text-lg sm:text-2xl font-bold text-white mt-1 max-w-lg">
                    {currentLesson.title}
                  </h2>
                  <div className="text-xs text-slate-400 mt-2">
                    Instructor: {course.instructor.name} · HD 1080p Stream
                  </div>
                </div>

                {/* Video Controls Bar */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 space-y-2 opacity-95 transition-opacity">
                  {/* Progress scrub bar */}
                  <div
                    className="w-full bg-slate-700 h-1.5 rounded-full cursor-pointer relative"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const newPct = Math.round((clickX / rect.width) * 100);
                      setVideoProgress(newPct);
                    }}
                  >
                    <div
                      className="bg-[#004AAD] h-full rounded-full relative"
                      style={{ width: `${videoProgress}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow"></div>
                    </div>
                  </div>

                  {/* Buttons strip */}
                  <div className="flex items-center justify-between text-xs text-white">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        aria-label={isPlaying ? 'Pause video' : 'Play video'}
                        className="hover:text-blue-400"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                        className="hover:text-blue-400"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>

                      <span className="text-[13px] text-slate-300 tabular-nums">
                        {Math.floor((currentLesson.durationMinutes * (videoProgress / 100)))}:12 / {currentLesson.durationMinutes}:00
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Playback speed */}
                      <button
                        onClick={() => {
                          const speeds = ['1.0x', '1.25x', '1.5x', '2.0x'];
                          const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                          setPlaybackSpeed(next);
                        }}
                        className="text-[13px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:text-white"
                      >
                        {playbackSpeed}
                      </button>

                      <button aria-label="Fullscreen" className="hover:text-blue-400">
                        <Maximize className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
            {upNext && upNext.id !== currentLesson.id && (
              <UpNextOverlay
                key={upNext.id}
                title={upNext.title}
                kind={upNext.type === 'quiz' ? 'Quiz' : upNext.type === 'video' ? 'Video lesson' : 'Lesson'}
                seconds={AUTOPLAY_COUNTDOWN_SECONDS}
                onPlayNow={() => openLesson(upNext, true)}
                onCancel={() => setUpNext(null)}
              />
            )}
          </div>

          {/* Lesson Navigation Header & Complete Button */}
          <div className="bg-white p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#111827]">
                {currentLesson.title}
              </h2>
              <div className="text-xs text-[#64748B]">
                Duration: {currentLesson.durationMinutes} minutes · Type: {currentLesson.type}
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <button
                type="button"
                role="switch"
                aria-checked={autoAdvance}
                onClick={toggleAutoAdvance}
                title="Play the next lesson automatically when a video ends"
                className="inline-flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-[#334155] rounded-lg hover:bg-slate-100"
              >
                <span className={`relative inline-block w-8 h-[18px] rounded-full transition-colors ${autoAdvance ? 'bg-[#004AAD]' : 'bg-slate-300'}`}>
                  <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-[left] ${autoAdvance ? 'left-[16px]' : 'left-[2px]'}`} />
                </span>
                <span>Autoplay</span>
              </button>
              <button
                disabled={!prevLesson}
                onClick={handlePrevLesson}
                className="px-3 py-2 text-xs font-semibold bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                onClick={handleToggleComplete}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  currentLessonCompleted
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#004AAD] text-white hover:bg-[#003B8B]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{currentLessonCompleted ? 'Completed' : 'Mark as Complete'}</span>
              </button>

              <button
                disabled={!nextLesson}
                onClick={handleNextLesson}
                className="px-3 py-2 text-xs font-semibold bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Player Lower Tabs */}
          <div className="p-6 space-y-6">
            {/* 100% Curriculum Completed - Claim Certificate Banner */}
            {overallProgress === 100 && (
              <div className="bg-gradient-to-r from-[#004AAD] to-[#5E17EB] text-white p-5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <Award className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-extrabold tracking-wider text-amber-300">
                        Course complete
                      </span>
                      <span className="text-[12px] bg-white/20 px-2 py-0.5 rounded-full font-bold">100%</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-white mt-0.5">
                      {claimedCert ? 'Your certificate is ready' : 'Get your certificate of completion'}
                    </h3>
                    <p className="text-xs text-blue-100">
                      {claimedCert
                        ? 'Preview it, download it as a PDF and add it to your LinkedIn profile.'
                        : 'You have completed every lesson in this course.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => (claimedCert ? navigate(`/student/certificates?open=${encodeURIComponent(claimedCert.id)}`) : handleClaimCertificate())}
                  disabled={claimingCert}
                  className="px-5 py-2.5 text-xs font-bold text-[#004AAD] bg-white hover:bg-blue-50 rounded-xl shadow-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 self-stretch sm:self-auto justify-center"
                >
                  <Award className="w-4 h-4 text-[#004AAD]" />
                  <span>{claimingCert ? 'Issuing certificate…' : claimedCert ? 'View certificate' : 'Get certificate'}</span>
                </button>
              </div>
            )}

            {/* Tabs Bar */}
            <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2">
              {[
                { id: 'overview', label: 'Lecture Overview' },
                { id: 'notes', label: `Personal Notes (${notes.length})` },
                { id: 'resources', label: 'Downloads & Attachments' },
                { id: 'qa', label: 'Q&A Discussion' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#EBF3FF] text-[#004AAD]'
                      : 'text-[#64748B] hover:text-[#111827]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === 'overview' && (
              <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] space-y-4">
                <h3 className="font-display text-sm font-bold text-[#111827]">
                  About This Lesson
                </h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  In this session, we dissect enterprise architectural standards. You will examine the separation between client presenters, network services, and deterministic validation schemas.
                </p>
                <div className="pt-2 text-xs text-[#111827]">
                  <strong>Key Competencies:</strong>
                  <ul className="list-disc list-inside mt-1 text-[#64748B] space-y-1">
                    <li>Strict TypeScript boundary types</li>
                    <li>Asynchronous error handling and network fallback states</li>
                    <li>Unit testing interfaces with mock providers</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab: Notes */}
            {activeTab === 'notes' && (
              <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] space-y-6">
                <h3 className="font-display text-sm font-bold text-[#111827]">
                  Your Personal Study Notes
                </h3>
                <form onSubmit={handleAddNote} className="space-y-3">
                  <textarea
                    rows={3}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Take notes at this timestamp in the lesson..."
                    className="w-full p-3 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[#111827] focus:outline-none focus:border-[#004AAD]"
                  ></textarea>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save Note</span>
                  </button>
                </form>

                <div className="space-y-3 pt-2">
                  {notes.length === 0 ? (
                    <div className="text-xs text-[#64748B]">No notes taken yet for this course.</div>
                  ) : (
                    notes.map((n) => (
                      <div key={n.id} className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1 text-xs">
                        <div className="flex items-center justify-between text-[#64748B] text-[13px]">
                          <span className="font-semibold text-[#004AAD]">Timestamp Note</span>
                          <span>{n.createdAt}</span>
                        </div>
                        <p className="text-[#111827] leading-relaxed">{n.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Resources */}
            {activeTab === 'resources' && (
              <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] space-y-4">
                <h3 className="font-display text-lg font-bold text-[#111827]">Downloads for this lesson</h3>
                {(currentLesson.resources || []).length === 0 ? (
                  <p className="text-sm text-[#64748B]">This lesson has no downloadable resources.</p>
                ) : (
                  <div className="space-y-2">
                    {(currentLesson.resources || []).map((r) => (
                      <div key={r.id} className="p-3 border border-[#E2E8F0] rounded-xl flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-[#004AAD] shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-[#111827] block truncate">{r.name}</span>
                            <span className="text-[13px] text-[#64748B]">{r.size}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => (r.storagePath ? handleDownloadResource(r.storagePath, r.name) : r.downloadUrl && window.open(r.downloadUrl, '_blank', 'noopener'))}
                          className="ed-btn ed-btn-tonal ed-btn-sm shrink-0"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: QA */}
            {activeTab === 'qa' && (
              <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-[#111827]">
                    Lesson Q&A & Mentorship
                  </h3>
                  <span className="text-[13px] text-[#64748B]">Instructor Mentorship</span>
                </div>

                <div className="p-6 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-center text-xs text-[#64748B] space-y-2">
                  <p className="font-semibold text-[#111827]">Have a question about this lecture?</p>
                  <p className="max-w-md mx-auto">
                    Type your question below. Course instructors and community teaching assistants respond directly.
                  </p>
                  <div className="pt-2 flex gap-2 max-w-lg mx-auto">
                    <input
                      type="text"
                      placeholder="Ask a question about this lesson..."
                      className="flex-1 p-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#111827] focus:outline-none focus:border-[#004AAD]"
                    />
                    <button
                      type="button"
                      onClick={() => showToast('Question submitted to instructor queue', 'success')}
                      className="px-3.5 py-2 text-sm font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full transition-colors whitespace-nowrap"
                    >
                      Post Question
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Curriculum Accordion Sidebar */}
        <aside className="w-full lg:w-80 xl:w-96 bg-white border-t lg:border-t-0 lg:border-l border-[#E2E8F0] shrink-0 flex flex-col h-auto lg:h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <h3 className="font-display text-sm font-bold text-[#111827]">
              Course Curriculum
            </h3>
            <div className="text-xs text-[#64748B] mt-0.5">
              {course.totalLessons} lectures · {overallProgress}% finished
            </div>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {course.curriculum.map((section) => {
              const isExpanded = expandedSections[section.id] !== false;
              return (
                <div key={section.id}>
                  <button
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        [section.id]: !prev[section.id],
                      }))
                    }
                    className="w-full p-3.5 text-left bg-[#F8FAFC] hover:bg-[#F1F5F9] flex items-center justify-between text-xs transition-colors"
                  >
                    <span className="font-bold text-[#111827]">{section.title}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#64748B] transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-[#E2E8F0] bg-white">
                      {section.lessons.map((lesson) => {
                        const isCurrent = lesson.id === currentLesson.id;
                        const isDone = isLessonCompleted(course.id, lesson.id);

                        return (
                          <button
                            key={lesson.id}
                            onClick={() => openLesson(lesson)}
                            className={`w-full p-3 text-left flex items-start gap-3 transition-colors ${
                              isCurrent
                                ? 'bg-[#EBF3FF] text-[#004AAD]'
                                : 'hover:bg-[#F8FAFC] text-[#111827]'
                            }`}
                          >
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if ((lesson.adiloFileId || lesson.adiloEmbedUrl) && !isLessonCompleted(course.id, lesson.id)) {
                                  showToast('Video lessons complete automatically after you watch at least 90% of the video.', 'info');
                                  return;
                                }
                                toggleLessonComplete(course.id, lesson.id);
                              }}
                              className="mt-0.5"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-[#CBD5E1] hover:border-[#004AAD]"></div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={`text-xs ${isCurrent ? 'font-bold' : 'font-medium'} truncate`}>
                                {lesson.title}
                              </p>
                              <div className="text-[13px] text-[#64748B] flex items-center gap-2 mt-0.5">
                                <span>{lesson.durationMinutes}m</span>
                                <span>·</span>
                                <span className="capitalize">{lesson.type}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Conferred Digital Diploma Modal */}
      {showCertModal && claimedCert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative border border-[#E2E8F0] space-y-5 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <button
              onClick={() => setShowCertModal(false)}
              className="absolute top-4 right-4 p-1.5 text-[#64748B] hover:text-[#111827] rounded-lg hover:bg-slate-100"
              aria-label="Close certificate modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl font-bold text-[#111827]">Congratulations! Your certificate is ready</h3>
              <p className="text-sm text-[#64748B]">
                Certificate ID <span className="font-mono text-[#004AAD]">{claimedCert.certificateCode}</span>
              </p>
            </div>

            <div className="rounded-xl bg-[#EEF1F7] p-2.5">
              <div className="shadow-md overflow-hidden rounded-sm">
                <CertificateFrame certificate={claimedCert} siteUrl={siteUrl()} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <Link
                to={`/verify-certificate?code=${encodeURIComponent(claimedCert.certificateCode)}`}
                target="_blank"
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Verification page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => {
                  setShowCertModal(false);
                  navigate(`/student/certificates?open=${encodeURIComponent(claimedCert.id)}`);
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full transition-colors"
              >
                Download or share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
