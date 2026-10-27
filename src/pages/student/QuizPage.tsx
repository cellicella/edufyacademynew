import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { quizService, courseService } from '../../services/api';
import { Quiz, Course } from '../../types';
import { QuizEvaluationResult } from '../../utils/courseUtils';
import confetti from 'canvas-confetti';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Award,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

export const QuizPage: React.FC = () => {
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedResult, setSubmittedResult] = useState<QuizEvaluationResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!quizId) return;
    quizService.getQuizById(quizId).then((q) => {
      setQuiz(q);
    });
    if (courseId) {
      courseService.getCourseById(courseId).then(setCourse);
    }
  }, [quizId, courseId]);

  if (!quiz) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center text-sm text-[#64748B]">
        Loading assessment quiz...
      </div>
    );
  }

  const currentQ = quiz.questions[currentQuestionIndex];
  const totalQuestions = quiz.questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const isSelected = selectedAnswers[currentQ?.id] !== undefined;

  const handleSelectOption = (optionIndex: number) => {
    if (submittedResult) return; // locked after submission
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionIndex,
    }));
  };

  const handleSubmitQuiz = async () => {
    setShowConfirmModal(false);
    const result = await quizService.submitQuiz(quiz.id, selectedAnswers);
    setSubmittedResult(result);
    if (result.passed) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  const handleRetryQuiz = () => {
    setSelectedAnswers({});
    setSubmittedResult(null);
    setCurrentQuestionIndex(0);
  };

  // If Quiz Submitted -> Show Results View
  if (submittedResult) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
        <div className="bg-white p-8 rounded-2xl border border-[#E2E8F0] shadow-sm text-center space-y-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              submittedResult.passed
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            {submittedResult.passed ? (
              <Award className="w-8 h-8" />
            ) : (
              <AlertCircle className="w-8 h-8" />
            )}
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111827]">
            {submittedResult.passed ? 'Assessment Passed!' : 'Assessment Not Passed'}
          </h1>

          <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto">
            {submittedResult.passed
              ? `Congratulations! You scored ${submittedResult.scorePercent}% (Passing target: ${quiz.passingScorePercent}%). Your performance has been credited toward your course completion.`
              : `You achieved a score of ${submittedResult.scorePercent}%. You need ${quiz.passingScorePercent}% or higher to pass. Review the correct explanations below and retry when ready.`}
          </p>

          <div className="flex items-center justify-center gap-6 py-4 border-y border-[#E2E8F0] text-xs">
            <div>
              <span className="text-[#64748B] block">Final Score</span>
              <span
                className={`font-display text-2xl font-bold tabular-nums ${
                  submittedResult.passed ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {submittedResult.scorePercent}%
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block">Correct Answers</span>
              <span className="font-display text-2xl font-bold text-[#111827] tabular-nums">
                {submittedResult.correctCount} / {submittedResult.totalQuestions}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block">Required Threshold</span>
              <span className="font-display text-2xl font-bold text-[#111827] tabular-nums">
                {quiz.passingScorePercent}%
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleRetryQuiz}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#111827] bg-[#F7F9FC] border border-[#E2E8F0] hover:bg-slate-100 rounded-lg flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Quiz</span>
            </button>

            {courseId && (
              <button
                onClick={() => navigate(`/learn/${courseId}`)}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg shadow flex items-center justify-center gap-1.5"
              >
                <span>Return to Course Lectures</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Detailed Question Review */}
        <div className="space-y-4">
          <h2 className="font-display text-base font-bold text-[#111827]">
            Question Performance Review
          </h2>
          {quiz.questions.map((q, idx) => {
            const userAns = selectedAnswers[q.id];
            const isCorrect = userAns === q.correctOptionIndex;

            return (
              <div
                key={q.id}
                className="bg-white p-5 rounded-xl border border-[#E2E8F0] space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#64748B]">Question {idx + 1}</span>
                    {isCorrect ? (
                      <span className="text-emerald-700 bg-emerald-50 font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Correct
                      </span>
                    ) : (
                      <span className="text-rose-700 bg-rose-50 font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Incorrect
                      </span>
                    )}
                  </div>
                </div>

                <p className="font-bold text-[#111827] text-sm">{q.question}</p>

                <div className="space-y-1.5 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const isUserChoice = userAns === optIdx;
                    const isRightAnswer = q.correctOptionIndex === optIdx;

                    let bgClass = 'bg-[#F8FAFC] border-[#E2E8F0] text-[#111827]';
                    if (isRightAnswer) {
                      bgClass = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium';
                    } else if (isUserChoice && !isRightAnswer) {
                      bgClass = 'bg-rose-50 border-rose-300 text-rose-950';
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${bgClass}`}
                      >
                        <span>{opt}</span>
                        {isRightAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {isUserChoice && !isRightAnswer && (
                          <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 bg-blue-50/50 rounded-lg text-slate-700 text-[11px] leading-relaxed">
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active Quiz Answering View
  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      {/* Header with Exit Link & Progress */}
      <div className="flex items-center justify-between">
        {courseId ? (
          <Link
            to={`/learn/${courseId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#004AAD] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Assessment</span>
          </Link>
        ) : (
          <div></div>
        )}

        <div className="text-xs text-[#64748B]">
          Passing Grade: <strong className="text-[#111827] tabular-nums">{quiz.passingScorePercent}%</strong>
        </div>
      </div>

      {/* Progress Strip */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] flex items-center justify-between text-xs">
        <div>
          <span className="font-bold text-[#111827]">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
          <span className="text-[#64748B] ml-2">
            ({answeredCount} of {totalQuestions} answered)
          </span>
        </div>
        <div className="w-32 bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#004AAD] h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-6">
        <h2 className="font-display text-lg sm:text-xl font-bold text-[#111827] leading-relaxed">
          {currentQ.question}
        </h2>

        {/* Options list */}
        <div className="space-y-3">
          {currentQ.options.map((option, optIdx) => {
            const selected = selectedAnswers[currentQ.id] === optIdx;

            return (
              <button
                key={optIdx}
                onClick={() => handleSelectOption(optIdx)}
                className={`w-full p-4 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-start justify-between gap-4 ${
                  selected
                    ? 'border-[#004AAD] bg-[#EBF3FF] text-[#004AAD] ring-1 ring-[#004AAD]'
                    : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#111827]'
                }`}
              >
                <span>{option}</span>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    selected ? 'border-[#004AAD] bg-[#004AAD]' : 'border-slate-300'
                  }`}
                >
                  {selected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Navigation row between questions */}
        <div className="pt-6 border-t border-[#E2E8F0] flex items-center justify-between">
          <button
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
            className="px-4 py-2 text-xs font-semibold text-[#111827] bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          {currentQuestionIndex < totalQuestions - 1 ? (
            <button
              onClick={() => setCurrentQuestionIndex((i) => Math.min(totalQuestions - 1, i + 1))}
              className="px-5 py-2 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg transition-colors flex items-center gap-1.5 shadow"
            >
              <span>Next Question</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow"
            >
              <span>Submit Assessment</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[#111827]">
              Submit Assessment Answers?
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              You have answered {answeredCount} of {totalQuestions} questions. Are you ready to submit your assessment for scoring?
            </p>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#111827] bg-white border border-[#E2E8F0] rounded-lg hover:bg-slate-50"
              >
                Review Answers
              </button>
              <button
                onClick={handleSubmitQuiz}
                className="px-4 py-2 text-xs font-bold text-white bg-[#004AAD] rounded-lg hover:bg-[#003B8B]"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
