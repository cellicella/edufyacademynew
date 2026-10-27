import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courseService, certificateService, storageService } from '../../services/api';
import { Course, Lesson, CourseSection, Certificate } from '../../types';
import { useCourseProgress } from '../../context/CourseProgressContext';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { EdufyLogo } from '../../components/common/EdufyLogo';
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
  const navigate = useNavigate();

  const { isEnrolled, initiateCourseEnrollment, isProcessingPayment, showToast } = useCartWishlist();

  const {
    isLessonCompleted,
    toggleLessonComplete,
    markLessonComplete,
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
    showToast('Verifying curriculum completion & issuing credential...', 'info');
    const res = await certificateService.claimCertificate(course.id);
    setClaimingCert(false);
    if (res.success && res.certificate) {
      setClaimedCert(res.certificate);
      setShowCertModal(true);
      showToast('Accredited diploma conferred successfully!', 'success');
    } else {
      showToast(res.error || 'Failed to claim certificate. Please complete all lessons.', 'error');
    }
  };

  const handleDownloadResource = async (filename: string) => {
    if (!course) return;
    showToast(`Requesting signed download token from storage bucket...`, 'info');
    const signedUrl = await storageService.getDownloadUrl(course.id, filename);
    if (signedUrl) {
      showToast('Resource download started', 'success');
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      showToast('Resource downloaded from course materials', 'info');
    }
  };

  const handleNextLesson = () => {
    if (nextLesson) {
      setCurrentLesson(nextLesson);
    }
  };

  const handlePrevLesson = () => {
    if (prevLesson) {
      setCurrentLesson(prevLesson);
    }
  };

  const handleToggleComplete = () => {
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
            to={`/courses/${course.id}`}
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
                  onClick={() => initiateCourseEnrollment(course)}
                  disabled={isProcessingPayment}
                  className="px-6 py-3 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 mx-auto"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isProcessingPayment ? 'Processing...' : `Enroll Now via Razorpay ($${course.price.toFixed(2)})`}</span>
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

                      <span className="text-[11px] text-slate-300 tabular-nums">
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
                        className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:text-white"
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

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
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
                        Milestone Achieved
                      </span>
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">100% Complete</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-white mt-0.5">
                      Ready to Claim Official Certificate
                    </h3>
                    <p className="text-xs text-blue-100">
                      All lectures and proctored segments are verified. Issue your tamper-proof credential to your profile.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClaimCertificate}
                  disabled={claimingCert}
                  className="px-5 py-2.5 text-xs font-bold text-[#004AAD] bg-white hover:bg-blue-50 rounded-xl shadow-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 self-stretch sm:self-auto justify-center"
                >
                  <Award className="w-4 h-4 text-[#004AAD]" />
                  <span>{claimingCert ? 'Minting Credential...' : 'Claim Official Certificate'}</span>
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
              <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-4">
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
              <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-6">
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
                    className="px-4 py-2 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg flex items-center gap-1.5"
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
                        <div className="flex items-center justify-between text-[#64748B] text-[11px]">
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
              <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-4">
                <h3 className="font-display text-sm font-bold text-[#111827]">
                  Lesson Code & Resources
                </h3>
                <div className="space-y-2">
                  <div className="p-3 border border-[#E2E8F0] rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-[#004AAD]" />
                      <div>
                        <span className="font-semibold text-[#111827]">Lecture-03-SourceCode.zip</span>
                        <span className="text-[11px] text-[#64748B] block">Starter project repository · 2.4 MB</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadResource('Lecture-03-SourceCode.zip')}
                      className="px-3 py-1.5 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] rounded hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: QA */}
            {activeTab === 'qa' && (
              <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-[#111827]">
                    Lesson Q&A & Mentorship
                  </h3>
                  <span className="text-[11px] text-[#64748B]">Instructor Mentorship</span>
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
                      className="flex-1 p-2 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#111827] focus:outline-none focus:border-[#004AAD]"
                    />
                    <button
                      type="button"
                      onClick={() => showToast('Question submitted to instructor queue', 'success')}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors whitespace-nowrap"
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
                            onClick={() => setCurrentLesson(lesson)}
                            className={`w-full p-3 text-left flex items-start gap-3 transition-colors ${
                              isCurrent
                                ? 'bg-[#EBF3FF] text-[#004AAD]'
                                : 'hover:bg-[#F8FAFC] text-[#111827]'
                            }`}
                          >
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
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
                              <div className="text-[11px] text-[#64748B] flex items-center gap-2 mt-0.5">
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
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative border border-[#E2E8F0] space-y-6">
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
              <h3 className="font-display text-xl font-bold text-[#111827]">
                Official Diploma Conferred!
              </h3>
              <p className="text-xs text-[#64748B]">
                Your certificate has been permanently signed and registered in the public registry.
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-xl border border-[#E2E8F0] space-y-4 text-center">
              <EdufyLogo size="sm" className="justify-center" />
              <div className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider">
                Certificate Identifier: <span className="font-mono text-[#004AAD]">{claimedCert.certificateCode}</span>
              </div>
              <div className="font-display text-lg font-bold text-[#004AAD]">
                {claimedCert.studentName}
              </div>
              <p className="text-xs text-[#64748B]">has demonstrated verified mastery in</p>
              <div className="font-bold text-sm text-[#111827]">{claimedCert.courseTitle}</div>
              <div className="pt-2 text-[11px] text-[#64748B] flex justify-center gap-6 border-t border-[#E2E8F0]">
                <span>Issued: <strong>{claimedCert.issueDate}</strong></span>
                <span>Score: <strong className="text-emerald-600">{claimedCert.gradeScore}%</strong></span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <Link
                to="/verify-certificate"
                target="_blank"
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Verify Public Credential</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => {
                  setShowCertModal(false);
                  navigate('/student/certificates');
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors"
              >
                View in My Certificates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
