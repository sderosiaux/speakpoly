// Application configuration

export const config = {
  app: {
    name: 'SpeakPoly',
    tagline: 'Learn by talking with natives. Help them learn yours too.',
    minAge: 18,
    maxOpenRequests: 3,
    requestExpiryHours: 72,
    nudgeDaysSilent: 5,
    rematchDaysSilent: 7,
    realNameRevealMinHours: 5,
    realNameRevealMinWeeks: 2,
  },

  languages: {
    supported: ['en', 'fr', 'es'] as const,
    maxFluent: 2,
    minNative: 1,
  },

  matching: {
    weights: {
      languageCompatibility: 0.4,
      timeOverlap: 0.2,
      interestOverlap: 0.15,
      goalMatch: 0.1,
      reliability: 0.1,
      longevity: 0.05,
    },
  },

  chat: {
    maxVoiceNoteDuration: 120, // seconds
    maxMessageLength: 5000,
    typingIndicatorTimeout: 3000, // ms
    sessionInactivityTimeout: 30 * 60 * 1000, // 30 minutes
  },

  safety: {
    maxContactShareAttempts: 3,
    contactShareWindowDays: 7,
    rateLimitDuration: 24 * 60 * 60 * 1000, // 24 hours
    messageQuarantineThreshold: 0.7, // AI confidence threshold
  },

  performance: {
    messageDeliveryTargetMs: 300,
    matchListLoadTargetMs: 1000,
    topicCardsLoadTargetMs: 1000,
    safetyCheckTargetMs: 50,
    summaryGenerationTargetMs: 30000,
  },

  analytics: {
    events: {
      // Onboarding
      SIGNUP_STARTED: 'sign_up_started',
      AGE_GATE_PASSED: 'age_gate_passed',
      AGE_GATE_FAILED: 'age_gate_failed',
      LEVEL_TEST_STARTED: 'level_test_started',
      LEVEL_TEST_COMPLETED: 'level_test_done',
      LEVEL_ASSIGNED: 'level_assigned',
      PROFILE_COMPLETED: 'profile_completed',

      // Matching
      MATCH_LIST_VIEWED: 'match_list_viewed',
      MATCH_REQUESTED: 'match_requested',
      MATCH_ACCEPTED: 'match_accepted',
      MATCH_REJECTED: 'match_rejected',
      MATCH_EXPIRED: 'match_expired',
      PAIR_CREATED: 'pair_created',

      // Chat
      MESSAGE_SENT: 'message_sent',
      VOICE_NOTE_SENT: 'voice_note_sent',
      AUDIO_CALL_STARTED: 'audio_call_started',
      AUDIO_CALL_ENDED: 'audio_call_ended',
      SESSION_STARTED: 'session_started',
      SESSION_ENDED: 'session_ended',

      // AI
      AI_TOPICS_SHOWN: 'ai_topic_cards_shown',
      AI_TOPIC_USED: 'ai_topic_card_used',
      TOPIC_MARKED_DONE: 'topic_marked_done',
      SUMMARY_GENERATED: 'session_summary_generated',
      VOCAB_ITEMS_ADDED: 'vocab_items_added',

      // Safety
      CONTACT_REDACTED: 'contact_redacted',
      OFFPLATFORM_BLOCKED: 'offplatform_attempt_blocked',
      SAFETY_FLAG_TRIGGERED: 'safety_flag_triggered',
      MESSAGE_QUARANTINED: 'message_quarantined',
      REPORT_SUBMITTED: 'report_submitted',
      USER_BANNED: 'user_banned',

      // Engagement
      NUDGE_SENT: 'gentle_nudge_sent',
      REMATCH_REQUESTED: 'rematch_requested',
      REMATCH_COMPLETED: 'rematch_completed',
      REAL_NAME_SHOWN: 'real_name_offer_shown',
      REAL_NAME_ACCEPTED: 'real_name_optin',

      // Progress
      PROGRESS_VIEWED: 'progress_viewed',
      QUALITY_SCORES_UPDATED: 'quality_scores_updated',
    },
  },

  motives: [
    'travel',
    'study',
    'work',
    'culture',
    'exam',
    'friendly',
  ] as const,

  defaultInterests: [
    'movies',
    'music',
    'sports',
    'cooking',
    'travel',
    'technology',
    'books',
    'art',
    'nature',
    'gaming',
    'fashion',
    'photography',
    'fitness',
    'science',
    'history',
    'politics',
    'business',
    'philosophy',
    'psychology',
    'languages',
  ] as const,
};

export type SupportedLanguage = typeof config.languages.supported[number];
export type UserMotive = typeof config.motives[number];
export type DefaultInterest = typeof config.defaultInterests[number];