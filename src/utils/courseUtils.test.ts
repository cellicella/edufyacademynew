import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCourseProgress,
  calculateDiscountPercent,
  formatDuration,
  gradeQuizSubmission,
  validateCertificateCodeFormat,
} from './courseUtils';
import { Quiz } from '../types';

test('calculateCourseProgress computes proper percentage', () => {
  assert.equal(calculateCourseProgress(10, ['l1', 'l2', 'l3']), 30);
  assert.equal(calculateCourseProgress(10, []), 0);
  assert.equal(calculateCourseProgress(10, ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10']), 100);
  assert.equal(calculateCourseProgress(0, ['l1']), 0);
});

test('calculateDiscountPercent computes accurate savings', () => {
  assert.equal(calculateDiscountPercent(49.99, 99.99), 50);
  assert.equal(calculateDiscountPercent(100, 100), 0);
  assert.equal(calculateDiscountPercent(120, 100), 0);
  assert.equal(calculateDiscountPercent(19.99, 89.99), 78);
});

test('formatDuration formats hours and minutes nicely', () => {
  assert.equal(formatDuration(0.5), '30m');
  assert.equal(formatDuration(2), '2h');
  assert.equal(formatDuration(12.5), '12h 30m');
});

test('gradeQuizSubmission calculates pass and fail outcomes', () => {
  const mockQuiz: Quiz = {
    id: 'quiz-1',
    title: 'React Fundamentals',
    passingScorePercent: 80,
    questions: [
      { id: 'q1', question: 'What is JSX?', options: ['A', 'B', 'C'], correctOptionIndex: 1, explanation: 'Syntax' },
      { id: 'q2', question: 'What is a hook?', options: ['A', 'B', 'C'], correctOptionIndex: 0, explanation: 'Function' },
      { id: 'q3', question: 'What is state?', options: ['A', 'B', 'C'], correctOptionIndex: 2, explanation: 'Data' },
      { id: 'q4', question: 'What is a prop?', options: ['A', 'B', 'C'], correctOptionIndex: 0, explanation: 'Input' },
      { id: 'q5', question: 'What is useEffect?', options: ['A', 'B', 'C'], correctOptionIndex: 1, explanation: 'Side effect' },
    ],
  };

  // 4 of 5 correct = 80% (Pass)
  const answersPass = {
    q1: 1,
    q2: 0,
    q3: 2,
    q4: 0,
    q5: 0, // incorrect
  };
  const resultPass = gradeQuizSubmission(mockQuiz, answersPass);
  assert.equal(resultPass.scorePercent, 80);
  assert.equal(resultPass.correctCount, 4);
  assert.equal(resultPass.passed, true);

  // 2 of 5 correct = 40% (Fail)
  const answersFail = {
    q1: 1,
    q2: 2,
    q3: 0,
    q4: 0,
    q5: 0,
  };
  const resultFail = gradeQuizSubmission(mockQuiz, answersFail);
  assert.equal(resultFail.scorePercent, 40);
  assert.equal(resultFail.correctCount, 2);
  assert.equal(resultFail.passed, false);
});

test('validateCertificateCodeFormat validates certificate patterns', () => {
  assert.equal(validateCertificateCodeFormat('EDU-2026-98421'), true);
  assert.equal(validateCertificateCodeFormat('edu-2026-abcde'), true);
  assert.equal(validateCertificateCodeFormat('INVALID-CODE'), false);
  assert.equal(validateCertificateCodeFormat(''), false);
});
