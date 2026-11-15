import React from 'react';
import { Video, FileText, HelpCircle, Paperclip, Plus, Trash2, Check, Upload } from 'lucide-react';
import { Lesson, LessonResource, QuizQuestion } from '../../types';
import { AdiloUploader } from './AdiloUploader';

type Bucket = 'course-thumbnails' | 'course-videos' | 'course-materials';

interface Props {
  lesson: Lesson;
  onChange: (fields: Partial<Lesson>) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, bucket: Bucket, onSuccess: (url: string, path: string) => void, key: string) => void;
  uploading: string | null;
  uploadKey: string;
  courseId?: string | null;
  notify?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const uid = () => `tmp-${Math.random().toString(36).slice(2, 9)}`;
const fmtSize = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Udemy-style lecture editor: choose Video / Article / Quiz, attach downloadable resources.
 */
export const LessonContentEditor: React.FC<Props> = ({ lesson, onChange, onUpload, uploading, uploadKey, courseId, notify }) => {
  const type = lesson.type || 'video';
  const resources = lesson.resources || [];
  const quiz = lesson.quiz || { id: lesson.quizId || uid(), title: lesson.title, passingScorePercent: 70, questions: [] };

  const setQuiz = (q: typeof quiz) => onChange({ quiz: q });
  const setQuestion = (i: number, fields: Partial<QuizQuestion>) =>
    setQuiz({ ...quiz, questions: quiz.questions.map((q, idx) => (idx === i ? { ...q, ...fields } : q)) });
  const addQuestion = () =>
    setQuiz({ ...quiz, questions: [...quiz.questions, { id: uid(), question: '', options: ['', '', '', ''], correctOptionIndex: 0, explanation: '' }] });

  const tabs: { id: Lesson['type']; label: string; icon: React.ElementType }[] = [
    { id: 'video', label: 'Video', icon: Video },
    { id: 'article', label: 'Article', icon: FileText },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  ];

  return (
    <div className="pt-3 border-t border-[#F1F5F9] space-y-4">
      {/* Content type */}
      <div className="inline-flex gap-1 p-1 bg-[#F1F5F9] rounded-full">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange({ type: t.id })}
            className={`h-9 px-4 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5 ${type === t.id ? 'bg-white text-[#004AAD] shadow-sm' : 'text-[#475569]'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {type === 'video' && (
        <div className="space-y-2">
          <AdiloUploader lesson={lesson} courseId={courseId} onChange={onChange} notify={notify} />
          {!lesson.adiloFileId && <div className="pt-1 text-[13px] font-semibold uppercase tracking-wide text-[#94A3B8]">Or use a video link</div>}
          <label className="text-[14px] font-semibold text-[#334155] flex items-center justify-between">
            <span>Lecture video</span>
            {lesson.videoUrl && <span className="text-[13px] text-emerald-700 inline-flex items-center gap-1"><Check className="w-4 h-4" /> Attached</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={lesson.videoUrl || ''}
              onChange={(e) => onChange({ videoUrl: e.target.value })}
              placeholder="Paste a video URL (.mp4, YouTube/Vimeo embed) or upload"
              className="ed-field !h-11 text-[15px]"
            />
            <label className="ed-btn ed-btn-tonal ed-btn-sm cursor-pointer shrink-0">
              <Upload className="w-4 h-4" />
              {uploading === `${uploadKey}-video` ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => onUpload(e, 'course-videos', (url, path) => onChange({ videoUrl: url, storageAssetPath: path }), `${uploadKey}-video`)}
              />
            </label>
          </div>
          {lesson.videoUrl && /\.(mp4|webm|mov)(\?|$)/i.test(lesson.videoUrl) && (
            <video src={lesson.videoUrl} controls className="w-full max-w-md rounded-xl bg-black aspect-video" />
          )}
          <textarea
            rows={2}
            value={lesson.contentText || ''}
            onChange={(e) => onChange({ contentText: e.target.value })}
            placeholder="Lecture description / notes shown under the video"
            className="ed-field !h-auto py-3 text-[15px]"
          />
        </div>
      )}

      {type === 'article' && (
        <div className="space-y-2">
          <label className="text-[14px] font-semibold text-[#334155]">Article content</label>
          <textarea
            rows={8}
            value={lesson.contentText || ''}
            onChange={(e) => onChange({ contentText: e.target.value })}
            placeholder="Write the lesson. Line breaks are preserved."
            className="ed-field !h-auto py-3 text-[15px] leading-relaxed"
          />
        </div>
      )}

      {type === 'quiz' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <label className="block">
              <span className="text-[14px] font-semibold text-[#334155]">Quiz title</span>
              <input className="ed-field !h-11 mt-1 text-[15px]" value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[14px] font-semibold text-[#334155]">Pass mark (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                className="ed-field !h-11 mt-1 text-[15px]"
                value={quiz.passingScorePercent}
                onChange={(e) => setQuiz({ ...quiz, passingScorePercent: Number(e.target.value) || 70 })}
              />
            </label>
          </div>

          {quiz.questions.map((q, i) => (
            <div key={q.id} className="p-4 rounded-2xl border border-[#E2E8F0] bg-[#F7F9FC] space-y-3">
              <div className="flex items-start gap-2">
                <span className="mt-3 text-[13px] font-bold text-[#64748B] w-6">Q{i + 1}</span>
                <input className="ed-field !h-11 text-[15px]" placeholder="Question" value={q.question} onChange={(e) => setQuestion(i, { question: e.target.value })} />
                <button type="button" onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, idx) => idx !== i) })} className="mt-2 p-2 text-[#64748B] hover:text-rose-600" aria-label="Delete question">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                {q.options.map((opt, oi) => (
                  <label key={oi} className={`flex items-center gap-2 px-3 h-11 rounded-xl border bg-white ${q.correctOptionIndex === oi ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-[#CBD5E1]'}`}>
                    <input type="radio" name={`correct-${q.id}`} checked={q.correctOptionIndex === oi} onChange={() => setQuestion(i, { correctOptionIndex: oi })} title="Mark as correct answer" />
                    <input
                      className="flex-1 min-w-0 bg-transparent text-[15px] focus:outline-none"
                      placeholder={`Option ${oi + 1}`}
                      value={opt}
                      onChange={(e) => setQuestion(i, { options: q.options.map((o, idx) => (idx === oi ? e.target.value : o)) })}
                    />
                  </label>
                ))}
              </div>
              <input
                className="ed-field !h-11 text-[15px] ml-8 !w-[calc(100%-2rem)]"
                placeholder="Explanation shown after answering (optional)"
                value={q.explanation}
                onChange={(e) => setQuestion(i, { explanation: e.target.value })}
              />
            </div>
          ))}
          <button type="button" onClick={addQuestion} className="ed-btn ed-btn-tonal ed-btn-sm">
            <Plus className="w-4 h-4" /> Add question
          </button>
          <p className="text-[13px] text-[#64748B]">Select the radio button next to the correct answer. Questions need at least two options.</p>
        </div>
      )}

      {/* Resources */}
      <div className="space-y-2">
        <div className="text-[14px] font-semibold text-[#334155] flex items-center gap-1.5"><Paperclip className="w-4 h-4" /> Downloadable resources</div>
        {resources.length > 0 && (
          <ul className="space-y-1.5">
            {resources.map((r: LessonResource) => (
              <li key={r.id} className="flex items-center gap-3 px-3 h-10 rounded-xl border border-[#E2E8F0] text-[14px]">
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-[#64748B]">{r.size}</span>
                <button type="button" onClick={() => onChange({ resources: resources.filter((x) => x.id !== r.id) })} className="text-[#64748B] hover:text-rose-600" aria-label="Remove resource">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="ed-btn ed-btn-outlined ed-btn-sm cursor-pointer">
          <Plus className="w-4 h-4" />
          {uploading === `${uploadKey}-res` ? 'Uploading…' : 'Add resource (PDF, ZIP, slides…)'}
          <input
            type="file"
            className="hidden"
            disabled={uploading !== null}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onUpload(
                e,
                'course-materials',
                (_url, path) => onChange({ resources: [...resources, { id: uid(), name: file.name, size: fmtSize(file.size), storagePath: path }] }),
                `${uploadKey}-res`
              );
            }}
          />
        </label>
        <p className="text-[13px] text-[#64748B]">Resources are private — only enrolled learners can download them.</p>
      </div>
    </div>
  );
};
