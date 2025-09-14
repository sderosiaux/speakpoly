import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Contact information detection patterns
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
const PHONE_PATTERN = /(\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g;
const SOCIAL_PATTERNS = [
  /@[a-zA-Z0-9_]{1,30}/g, // Twitter/Instagram handles
  /(?:https?:\/\/)?(?:www\.)?(?:facebook|fb|instagram|twitter|linkedin|telegram|whatsapp|discord|snapchat)\.(?:com|me|org)\/[^\s]+/gi,
  /(?:wa\.me|t\.me|discord\.gg)\/[^\s]+/gi,
];

export interface RedactionResult {
  text: string;
  redactions: Array<{ start: number; end: number; type: string }>;
  hasRedactions: boolean;
}

export function detectAndRedactContactInfo(text: string): RedactionResult {
  let processedText = text;
  const redactions: Array<{ start: number; end: number; type: string }> = [];

  // Detect and replace emails
  const emails = text.match(EMAIL_PATTERN);
  if (emails) {
    emails.forEach(email => {
      const index = processedText.indexOf(email);
      if (index !== -1) {
        redactions.push({ start: index, end: index + email.length, type: 'email' });
        processedText = processedText.replace(email, '[EMAIL REDACTED]');
      }
    });
  }

  // Detect and replace phone numbers
  const phones = text.match(PHONE_PATTERN);
  if (phones) {
    phones.forEach(phone => {
      // Filter out false positives (too short, likely dates/times)
      if (phone.replace(/\D/g, '').length >= 7) {
        const index = processedText.indexOf(phone);
        if (index !== -1) {
          redactions.push({ start: index, end: index + phone.length, type: 'phone' });
          processedText = processedText.replace(phone, '[PHONE REDACTED]');
        }
      }
    });
  }

  // Detect and replace social media handles/links
  SOCIAL_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const index = processedText.indexOf(match);
        if (index !== -1) {
          redactions.push({ start: index, end: index + match.length, type: 'social' });
          processedText = processedText.replace(match, '[CONTACT REDACTED]');
        }
      });
    }
  });

  return {
    text: processedText,
    redactions,
    hasRedactions: redactions.length > 0
  };
}

// Validation schemas
export const pseudonymSchema = z.string()
  .min(3, 'Pseudonym must be at least 3 characters')
  .max(20, 'Pseudonym must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Pseudonym can only contain letters, numbers, underscores, and hyphens')
  .refine(
    (val) => !detectAndRedactContactInfo(val).hasRedactions,
    'Pseudonym cannot contain contact information'
  );

export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Time overlap calculation
export function calculateTimeOverlap(
  slots1: Array<{ day: number; startTime: string; endTime: string }>,
  slots2: Array<{ day: number; startTime: string; endTime: string }>
): number {
  let totalOverlap = 0;

  for (const slot1 of slots1) {
    for (const slot2 of slots2) {
      if (slot1.day === slot2.day) {
        const start1 = timeToMinutes(slot1.startTime);
        const end1 = timeToMinutes(slot1.endTime);
        const start2 = timeToMinutes(slot2.startTime);
        const end2 = timeToMinutes(slot2.endTime);

        const overlapStart = Math.max(start1, start2);
        const overlapEnd = Math.min(end1, end2);

        if (overlapStart < overlapEnd) {
          totalOverlap += overlapEnd - overlapStart;
        }
      }
    }
  }

  return totalOverlap;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Jaccard similarity for interests
export function calculateJaccardSimilarity(set1: string[], set2: string[]): number {
  const intersection = set1.filter(x => set2.includes(x)).length;
  const union = new Set([...set1, ...set2]).size;
  return union === 0 ? 0 : intersection / union;
}

// Language compatibility check
export function checkLanguageCompatibility(
  user1Native: string[],
  user1Learning: string,
  user2Native: string[],
  user2Learning: string
): boolean {
  return user1Native.includes(user2Learning) && user2Native.includes(user1Learning);
}

// Generate session ID
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Calculate language balance in conversation
export function calculateLanguageBalance(
  messages: Array<{ language: string; wordCount: number }>
): Record<string, number> {
  const totals: Record<string, number> = {};
  let totalWords = 0;

  messages.forEach(msg => {
    totals[msg.language] = (totals[msg.language] || 0) + msg.wordCount;
    totalWords += msg.wordCount;
  });

  const balance: Record<string, number> = {};
  Object.keys(totals).forEach(lang => {
    balance[lang] = totalWords > 0 ? (totals[lang] / totalWords) * 100 : 0;
  });

  return balance;
}