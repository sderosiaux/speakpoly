// Core type definitions for SpeakPoly

export type LanguageCode = 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt' | 'zh' | 'ja' | 'ko' | 'ru' | 'ar';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type UserMotive = 'travel' | 'study' | 'work' | 'culture' | 'exam' | 'friendly';

export interface TimeSlot {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

export interface LanguageTestQuestion {
  id: string;
  type: 'vocabulary' | 'grammar' | 'reading' | 'listening';
  level: CEFRLevel;
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
}

export interface MatchScore {
  userId: string;
  score: number;
  components: {
    languageCompatibility: number;
    timeOverlap: number;
    interestOverlap: number;
    goalMatch: number;
    reliability: number;
    longevity: number;
  };
}

export interface TopicCard {
  id: string;
  text: string;
  difficulty: CEFRLevel;
  tags: string[];
  followUpQuestions?: string[];
}

export interface SessionSummary {
  sessionId: string;
  duration: number;
  newWords: Array<{
    word: string;
    definition: string;
    context: string;
  }>;
  commonMistakes: Array<{
    mistake: string;
    correction: string;
    explanation: string;
  }>;
  followUpTask?: string;
  languageBalance: {
    [key: string]: number; // percentage for each language
  };
}

export interface SafetyCheck {
  passed: boolean;
  flags: Array<{
    type: 'contact_info' | 'inappropriate' | 'harassment' | 'scam' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    details?: string;
  }>;
  redactions: Array<{
    start: number;
    end: number;
    type: string;
  }>;
}

export interface UserProgress {
  activeHours: number;
  wordsLearned: number;
  topicsCovered: string[];
  pairsFormed: number;
  longestPairWeeks: number;
  currentStreak: number;
}

export interface NotificationPayload {
  type: 'match_request' | 'match_accepted' | 'message' | 'nudge' | 'summary_ready' | 'real_name_reveal';
  userId: string;
  data: any;
  priority: 'low' | 'medium' | 'high';
}