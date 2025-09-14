'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { config } from '@speakpoly/config';
import { cefrTestQuestions, calculateCEFRLevel, selfAssessmentQuestions } from '@speakpoly/types/cefr';
import type { CEFRTestQuestion, CEFRTestResult } from '@speakpoly/types/cefr';
import type { LanguageCode } from '@speakpoly/types';

export default function LanguageTestPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ questionId: string; answer: number; isCorrect: boolean }>>([]);
  const [testQuestions, setTestQuestions] = useState<CEFRTestQuestion[]>([]);
  const [showSelfAssessment, setShowSelfAssessment] = useState(false);
  const [selfAssessmentAnswers, setSelfAssessmentAnswers] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    if (testStarted && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      handleTestComplete();
    }
  }, [testStarted, timeLeft]);

  const startTest = (language: LanguageCode) => {
    setSelectedLanguage(language);
    const questions = cefrTestQuestions[language] || cefrTestQuestions.en;

    // Select a mix of questions from different levels
    const selectedQuestions = [
      ...questions.filter(q => q.level === 'A1').slice(0, 2),
      ...questions.filter(q => q.level === 'A2').slice(0, 2),
      ...questions.filter(q => q.level === 'B1').slice(0, 2),
      ...questions.filter(q => q.level === 'B2').slice(0, 2),
      ...questions.filter(q => q.level === 'C1').slice(0, 2),
    ].sort(() => Math.random() - 0.5); // Shuffle questions

    setTestQuestions(selectedQuestions);
    setTestStarted(true);

    // Track test started
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: config.analytics.events.LEVEL_TEST_STARTED,
        data: { language },
      }),
    }).catch(() => {});
  };

  const handleAnswer = (answerIndex: number) => {
    const currentQuestion = testQuestions[currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;

    setAnswers([
      ...answers,
      {
        questionId: currentQuestion.id,
        answer: answerIndex,
        isCorrect,
      },
    ]);

    if (currentQuestionIndex < testQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setShowSelfAssessment(true);
    }
  };

  const handleTestComplete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const result = calculateCEFRLevel(answers, testQuestions);

    // Adjust based on self-assessment
    const selfAssessmentLevel = Object.entries(selfAssessmentAnswers)
      .filter(([_, value]) => value)
      .map(([id]) => selfAssessmentQuestions.find(q => q.id === id)?.level)
      .filter(Boolean)
      .sort()
      .reverse()[0];

    if (selfAssessmentLevel) {
      // Consider self-assessment but don't let it override test by more than 1 level
      const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const testLevelIndex = levels.indexOf(result.level);
      const selfLevelIndex = levels.indexOf(selfAssessmentLevel);

      if (Math.abs(testLevelIndex - selfLevelIndex) <= 1) {
        result.level = selfAssessmentLevel as any;
      }
    }

    try {
      const response = await fetch('/api/onboarding/language-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: selectedLanguage,
          testResult: result,
          answers,
          selfAssessment: selfAssessmentAnswers,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save test results');
      }

      // Track test completion
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: config.analytics.events.LEVEL_TEST_COMPLETED,
          data: {
            language: selectedLanguage,
            level: result.level,
            score: result.score,
          },
        }),
      }).catch(() => {});

      toast.success(`Your level: ${result.level} (${Math.round(result.score)}%)`);
      router.push('/onboarding/profile');
    } catch (error) {
      toast.error('Failed to save test results');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!testStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">
              Language Assessment
            </h1>
            <p className="text-neutral-600">
              Take a quick 3-5 minute test to assess your language level
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Choose the language you want to learn:</h2>
            <div className="grid grid-cols-3 gap-4">
              {config.languages.supported.map((lang) => (
                <button
                  key={lang}
                  onClick={() => startTest(lang as LanguageCode)}
                  className="p-6 border-2 border-neutral-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all"
                >
                  <div className="text-4xl mb-2">
                    {lang === 'en' && '🇬🇧'}
                    {lang === 'fr' && '🇫🇷'}
                    {lang === 'es' && '🇪🇸'}
                  </div>
                  <div className="font-medium">
                    {lang === 'en' && 'English'}
                    {lang === 'fr' && 'Français'}
                    {lang === 'es' && 'Español'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-primary-50 rounded-lg p-4">
            <h3 className="font-semibold text-primary-900 mb-2">What to expect:</h3>
            <ul className="text-sm text-primary-800 space-y-1">
              <li>• 10 questions testing vocabulary, grammar, and reading</li>
              <li>• Self-assessment to fine-tune your level</li>
              <li>• Results from A1 (Beginner) to C1 (Advanced)</li>
              <li>• Takes about 3-5 minutes to complete</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (showSelfAssessment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">
              Self Assessment
            </h1>
            <p className="text-neutral-600">
              Check the statements that apply to you
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {selfAssessmentQuestions.map((question) => (
              <label
                key={question.id}
                className="flex items-start gap-3 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selfAssessmentAnswers[question.id] || false}
                  onChange={(e) =>
                    setSelfAssessmentAnswers({
                      ...selfAssessmentAnswers,
                      [question.id]: e.target.checked,
                    })
                  }
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                />
                <div>
                  <p className="text-neutral-900">{question.question}</p>
                  <span className="text-xs text-neutral-500">Level {question.level}</span>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={handleTestComplete}
            disabled={isSubmitting}
            className="w-full btn-primary"
          >
            {isSubmitting ? 'Processing...' : 'Complete Assessment'}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = testQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / testQuestions.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-neutral-600">
              Question {currentQuestionIndex + 1} of {testQuestions.length}
            </span>
            <span className="text-sm font-medium text-primary-600">
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentQuestion.context && (
              <div className="bg-neutral-50 rounded-lg p-4 mb-6">
                <p className="text-neutral-700 italic">{currentQuestion.context}</p>
              </div>
            )}

            <h2 className="text-xl font-semibold mb-6">{currentQuestion.question}</h2>

            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  className="w-full text-left p-4 border-2 border-neutral-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all"
                >
                  <span className="font-medium text-neutral-900">
                    {String.fromCharCode(65 + index)}.
                  </span>{' '}
                  {option}
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-between items-center">
              <span className="text-xs text-neutral-500">
                Level: {currentQuestion.level} | Type: {currentQuestion.type}
              </span>
              <button
                onClick={() => handleAnswer(-1)}
                className="text-sm text-neutral-500 hover:text-neutral-700"
              >
                Skip question →
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}