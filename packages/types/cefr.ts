// CEFR Language Testing Types and Questions

import { CEFRLevel, LanguageCode } from './index';

export interface CEFRTestQuestion {
  id: string;
  type: 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'self-assessment';
  level: CEFRLevel;
  language: LanguageCode;
  question: string;
  context?: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  weight: number;
}

export interface CEFRTestResult {
  level: CEFRLevel;
  score: number;
  breakdown: {
    vocabulary: number;
    grammar: number;
    reading: number;
    overall: number;
  };
  confidence: number;
  completedAt: Date;
}

// Sample test questions for each language and level
export const cefrTestQuestions: Record<LanguageCode, CEFRTestQuestion[]> = {
  en: [
    // A1 - Beginner
    {
      id: 'en-a1-1',
      type: 'vocabulary',
      level: 'A1',
      language: 'en',
      question: 'What is this? 🍎',
      options: ['Apple', 'Orange', 'Banana', 'Grape'],
      correctAnswer: 0,
      weight: 1,
    },
    {
      id: 'en-a1-2',
      type: 'grammar',
      level: 'A1',
      language: 'en',
      question: 'I ___ a student.',
      options: ['is', 'am', 'are', 'be'],
      correctAnswer: 1,
      weight: 1,
    },
    // A2 - Elementary
    {
      id: 'en-a2-1',
      type: 'vocabulary',
      level: 'A2',
      language: 'en',
      question: 'The opposite of "expensive" is:',
      options: ['cheap', 'big', 'new', 'fast'],
      correctAnswer: 0,
      weight: 1.5,
    },
    {
      id: 'en-a2-2',
      type: 'grammar',
      level: 'A2',
      language: 'en',
      question: 'She ___ to the store yesterday.',
      options: ['go', 'goes', 'went', 'going'],
      correctAnswer: 2,
      weight: 1.5,
    },
    // B1 - Intermediate
    {
      id: 'en-b1-1',
      type: 'reading',
      level: 'B1',
      language: 'en',
      context: 'The meeting has been postponed until further notice.',
      question: 'What happened to the meeting?',
      options: ['It was cancelled', 'It was delayed', 'It started early', 'It finished'],
      correctAnswer: 1,
      weight: 2,
    },
    {
      id: 'en-b1-2',
      type: 'grammar',
      level: 'B1',
      language: 'en',
      question: 'If I ___ more money, I would travel around the world.',
      options: ['have', 'had', 'will have', 'having'],
      correctAnswer: 1,
      weight: 2,
    },
    // B2 - Upper Intermediate
    {
      id: 'en-b2-1',
      type: 'vocabulary',
      level: 'B2',
      language: 'en',
      question: 'The company decided to ___ the project due to budget constraints.',
      options: ['abandon', 'abundant', 'absolve', 'abstract'],
      correctAnswer: 0,
      weight: 2.5,
    },
    {
      id: 'en-b2-2',
      type: 'grammar',
      level: 'B2',
      language: 'en',
      question: 'By next year, they ___ living here for a decade.',
      options: ['will be', 'will have been', 'are', 'were'],
      correctAnswer: 1,
      weight: 2.5,
    },
    // C1 - Advanced
    {
      id: 'en-c1-1',
      type: 'reading',
      level: 'C1',
      language: 'en',
      context: 'The ramifications of the policy change are yet to be fully comprehended by stakeholders.',
      question: 'What does "ramifications" mean in this context?',
      options: ['Benefits', 'Consequences', 'Requirements', 'Proposals'],
      correctAnswer: 1,
      weight: 3,
    },
    {
      id: 'en-c1-2',
      type: 'grammar',
      level: 'C1',
      language: 'en',
      question: 'Rarely ___ such a controversial decision been made.',
      options: ['has', 'have', 'had', 'having'],
      correctAnswer: 0,
      weight: 3,
    },
  ],

  fr: [
    // A1 - Beginner
    {
      id: 'fr-a1-1',
      type: 'vocabulary',
      level: 'A1',
      language: 'fr',
      question: 'Comment dit-on "Hello" en français?',
      options: ['Bonjour', 'Au revoir', 'Merci', 'Pardon'],
      correctAnswer: 0,
      weight: 1,
    },
    {
      id: 'fr-a1-2',
      type: 'grammar',
      level: 'A1',
      language: 'fr',
      question: 'Je ___ étudiant.',
      options: ['est', 'suis', 'es', 'sont'],
      correctAnswer: 1,
      weight: 1,
    },
    // A2 - Elementary
    {
      id: 'fr-a2-1',
      type: 'vocabulary',
      level: 'A2',
      language: 'fr',
      question: 'Le contraire de "grand" est:',
      options: ['petit', 'long', 'large', 'haut'],
      correctAnswer: 0,
      weight: 1.5,
    },
    {
      id: 'fr-a2-2',
      type: 'grammar',
      level: 'A2',
      language: 'fr',
      question: 'Hier, nous ___ au cinéma.',
      options: ['allons', 'sommes allés', 'irons', 'aller'],
      correctAnswer: 1,
      weight: 1.5,
    },
    // B1 - Intermediate
    {
      id: 'fr-b1-1',
      type: 'reading',
      level: 'B1',
      language: 'fr',
      context: 'La réunion a été reportée à une date ultérieure.',
      question: 'Qu\'est-il arrivé à la réunion?',
      options: ['Elle a été annulée', 'Elle a été retardée', 'Elle a commencé', 'Elle est finie'],
      correctAnswer: 1,
      weight: 2,
    },
    {
      id: 'fr-b1-2',
      type: 'grammar',
      level: 'B1',
      language: 'fr',
      question: 'Si j\'___ plus d\'argent, je voyagerais.',
      options: ['ai', 'avais', 'aurai', 'avoir'],
      correctAnswer: 1,
      weight: 2,
    },
  ],

  es: [
    // A1 - Beginner
    {
      id: 'es-a1-1',
      type: 'vocabulary',
      level: 'A1',
      language: 'es',
      question: '¿Cómo se dice "Good morning" en español?',
      options: ['Buenos días', 'Buenas noches', 'Adiós', 'Por favor'],
      correctAnswer: 0,
      weight: 1,
    },
    {
      id: 'es-a1-2',
      type: 'grammar',
      level: 'A1',
      language: 'es',
      question: 'Yo ___ estudiante.',
      options: ['es', 'soy', 'eres', 'somos'],
      correctAnswer: 1,
      weight: 1,
    },
    // A2 - Elementary
    {
      id: 'es-a2-1',
      type: 'vocabulary',
      level: 'A2',
      language: 'es',
      question: 'Lo opuesto de "alto" es:',
      options: ['bajo', 'ancho', 'largo', 'grande'],
      correctAnswer: 0,
      weight: 1.5,
    },
    {
      id: 'es-a2-2',
      type: 'grammar',
      level: 'A2',
      language: 'es',
      question: 'Ayer ___ al cine.',
      options: ['voy', 'fui', 'iré', 'vamos'],
      correctAnswer: 1,
      weight: 1.5,
    },
    // B1 - Intermediate
    {
      id: 'es-b1-1',
      type: 'reading',
      level: 'B1',
      language: 'es',
      context: 'La reunión ha sido pospuesta hasta nuevo aviso.',
      question: '¿Qué pasó con la reunión?',
      options: ['Fue cancelada', 'Fue retrasada', 'Empezó temprano', 'Terminó'],
      correctAnswer: 1,
      weight: 2,
    },
    {
      id: 'es-b1-2',
      type: 'grammar',
      level: 'B1',
      language: 'es',
      question: 'Si ___ más dinero, viajaría por el mundo.',
      options: ['tengo', 'tuviera', 'tendré', 'teniendo'],
      correctAnswer: 1,
      weight: 2,
    },
  ],
} as const;

// Self-assessment questions
export const selfAssessmentQuestions = [
  {
    id: 'self-1',
    question: 'I can understand and use familiar everyday expressions and very basic phrases.',
    level: 'A1' as CEFRLevel,
  },
  {
    id: 'self-2',
    question: 'I can communicate in simple and routine tasks requiring a simple exchange of information.',
    level: 'A2' as CEFRLevel,
  },
  {
    id: 'self-3',
    question: 'I can deal with most situations likely to arise while traveling in an area where the language is spoken.',
    level: 'B1' as CEFRLevel,
  },
  {
    id: 'self-4',
    question: 'I can interact with a degree of fluency that makes regular interaction with native speakers possible.',
    level: 'B2' as CEFRLevel,
  },
  {
    id: 'self-5',
    question: 'I can express myself fluently and spontaneously without much obvious searching for expressions.',
    level: 'C1' as CEFRLevel,
  },
];

export function calculateCEFRLevel(
  answers: Array<{ questionId: string; answer: number; isCorrect: boolean }>,
  questions: CEFRTestQuestion[]
): CEFRTestResult {
  const levelScores: Record<CEFRLevel, number> = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
  };

  const typeScores = {
    vocabulary: 0,
    grammar: 0,
    reading: 0,
    overall: 0,
  };

  let totalWeight = 0;
  let correctWeight = 0;

  answers.forEach((answer) => {
    const question = questions.find((q) => q.id === answer.questionId);
    if (!question) return;

    totalWeight += question.weight;
    if (answer.isCorrect) {
      correctWeight += question.weight;
      levelScores[question.level] += question.weight;

      if (question.type === 'vocabulary' || question.type === 'grammar' || question.type === 'reading') {
        typeScores[question.type] += 1;
      }
    }
  });

  const overallScore = totalWeight > 0 ? (correctWeight / totalWeight) * 100 : 0;
  typeScores.overall = overallScore;

  // Determine level based on weighted scores
  let determinedLevel: CEFRLevel = 'A1';
  let maxScore = 0;

  Object.entries(levelScores).forEach(([level, score]) => {
    if (score > maxScore) {
      maxScore = score;
      determinedLevel = level as CEFRLevel;
    }
  });

  // Adjust level based on overall performance
  if (overallScore < 40) determinedLevel = 'A1';
  else if (overallScore < 55) determinedLevel = 'A2';
  else if (overallScore < 70) determinedLevel = 'B1';
  else if (overallScore < 85) determinedLevel = 'B2';
  else if (overallScore < 95) determinedLevel = 'C1';
  else determinedLevel = 'C1'; // We don't assign C2 from the test

  return {
    level: determinedLevel,
    score: overallScore,
    breakdown: typeScores,
    confidence: Math.min(100, (answers.length / 10) * 100), // Confidence based on questions answered
    completedAt: new Date(),
  };
}