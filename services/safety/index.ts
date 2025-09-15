import axios from 'axios';
import FormData from 'form-data';
import { RedactionResult, detectAndRedactContactInfo } from '@speakpoly/utils';

// Sightengine API configuration
const SIGHTENGINE_API_URL = 'https://api.sightengine.com/1.0/text/check.json';
const SIGHTENGINE_API_USER = process.env.SIGHTENGINE_API_USER;
const SIGHTENGINE_API_SECRET = process.env.SIGHTENGINE_API_SECRET;

// Safety configuration
export interface SafetyConfig {
  enableSightengine?: boolean;
  ruleBasedCategories?: string[];
  mlModels?: string[];
  customBlacklist?: string;
  threshold?: number;
  language?: string;
  countries?: string[];
}

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  enableSightengine: true,
  ruleBasedCategories: [
    'profanity',
    'personal',
    'link',
    'drug',
    'weapon',
    'spam',
    'content-trade',
    'money-transaction',
    'extremism',
    'violence',
    'self-harm',
    'medical'
  ],
  mlModels: ['general', 'self-harm'],
  threshold: 0.7,
  language: 'en',
  countries: ['us', 'gb', 'fr', 'es', 'de']
};

// Safety violation levels
export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Safety result interface
export interface SafetyResult {
  safe: boolean;
  violations: SafetyViolation[];
  redactionResult: RedactionResult;
  processedText: string;
  confidence: number;
  metadata: {
    sightengineUsed: boolean;
    requestId?: string;
    timestamp: number;
  };
}

export interface SafetyViolation {
  type: string;
  severity: ViolationSeverity;
  confidence: number;
  description: string;
  category: 'rule-based' | 'ml-based' | 'contact-detection';
  action: 'block' | 'flag' | 'moderate';
}

// Sightengine API response interfaces
interface SightengineRuleBasedResponse {
  status: string;
  request: {
    id: string;
    timestamp: number;
    operations: number;
  };
  profanity?: {
    matches: Array<{
      intensity: string;
      match: string;
      type: string;
      start: number;
      end: number;
    }>;
  };
  personal?: {
    matches: Array<{
      match: string;
      type: string;
      start: number;
      end: number;
    }>;
  };
  link?: {
    matches: Array<{
      match: string;
      start: number;
      end: number;
    }>;
  };
  [key: string]: any;
}

interface SightengineMLResponse {
  status: string;
  request: {
    id: string;
    timestamp: number;
    operations: number;
  };
  moderation_classes: {
    available: string[];
    [key: string]: number | string[];
  };
}

export class SafetyService {
  private config: SafetyConfig;

  constructor(config: Partial<SafetyConfig> = {}) {
    this.config = { ...DEFAULT_SAFETY_CONFIG, ...config };
  }

  /**
   * Moderate text content using multiple safety layers
   */
  async moderateText(text: string, customConfig?: Partial<SafetyConfig>): Promise<SafetyResult> {
    const effectiveConfig = { ...this.config, ...customConfig };
    const violations: SafetyViolation[] = [];
    let confidence = 1.0;

    // Layer 1: Contact information detection and redaction
    const redactionResult = detectAndRedactContactInfo(text);
    if (redactionResult.hasRedactions) {
      redactionResult.redactions.forEach(redaction => {
        violations.push({
          type: `contact_${redaction.type}`,
          severity: ViolationSeverity.HIGH,
          confidence: 1.0,
          description: `Contact information detected: ${redaction.type}`,
          category: 'contact-detection',
          action: 'block'
        });
      });
    }

    let processedText = redactionResult.text;
    let sightengineUsed = false;
    let requestId: string | undefined;

    // Layer 2: Sightengine API moderation (if enabled and configured)
    if (effectiveConfig.enableSightengine && SIGHTENGINE_API_USER && SIGHTENGINE_API_SECRET) {
      try {
        // Rule-based moderation
        if (effectiveConfig.ruleBasedCategories && effectiveConfig.ruleBasedCategories.length > 0) {
          const ruleBasedResult = await this.performRuleBasedModeration(text, effectiveConfig);
          if (ruleBasedResult) {
            sightengineUsed = true;
            requestId = ruleBasedResult.request.id;
            const ruleViolations = this.processRuleBasedResponse(ruleBasedResult);
            violations.push(...ruleViolations);
          }
        }

        // ML-based moderation
        if (effectiveConfig.mlModels && effectiveConfig.mlModels.length > 0) {
          const mlResult = await this.performMLModeration(text, effectiveConfig);
          if (mlResult) {
            sightengineUsed = true;
            requestId = requestId || mlResult.request.id;
            const mlViolations = this.processMLResponse(mlResult, effectiveConfig.threshold || 0.7);
            violations.push(...mlViolations);

            // Update confidence based on ML results
            const scores = Object.values(mlResult.moderation_classes)
              .filter(val => typeof val === 'number') as number[];
            if (scores.length > 0) {
              confidence = Math.min(confidence, 1 - Math.max(...scores));
            }
          }
        }
      } catch (error) {
        console.error('Sightengine API error:', error);
        // Don't fail completely, continue with basic safety measures
        violations.push({
          type: 'moderation_api_error',
          severity: ViolationSeverity.LOW,
          confidence: 0.5,
          description: 'Content moderation API temporarily unavailable',
          category: 'rule-based',
          action: 'flag'
        });
      }
    }

    // Determine overall safety
    const criticalViolations = violations.filter(v => v.severity === ViolationSeverity.CRITICAL);
    const highViolations = violations.filter(v => v.severity === ViolationSeverity.HIGH);
    const blockingViolations = violations.filter(v => v.action === 'block');

    const safe = criticalViolations.length === 0 &&
                 highViolations.length === 0 &&
                 blockingViolations.length === 0;

    return {
      safe,
      violations,
      redactionResult,
      processedText,
      confidence,
      metadata: {
        sightengineUsed,
        requestId,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Perform rule-based moderation via Sightengine
   */
  private async performRuleBasedModeration(
    text: string,
    config: SafetyConfig
  ): Promise<SightengineRuleBasedResponse | null> {
    const data = new FormData();
    data.append('text', text);
    data.append('lang', config.language || 'en');
    data.append('categories', config.ruleBasedCategories?.join(',') || '');
    data.append('mode', 'rules');
    data.append('api_user', SIGHTENGINE_API_USER!);
    data.append('api_secret', SIGHTENGINE_API_SECRET!);

    if (config.countries && config.countries.length > 0) {
      data.append('opt_countries', config.countries.join(','));
    }

    if (config.customBlacklist) {
      data.append('list', config.customBlacklist);
    }

    const response = await axios({
      url: SIGHTENGINE_API_URL,
      method: 'post',
      data: data,
      headers: data.getHeaders(),
      timeout: 10000
    });

    return response.data.status === 'success' ? response.data : null;
  }

  /**
   * Perform ML-based moderation via Sightengine
   */
  private async performMLModeration(
    text: string,
    config: SafetyConfig
  ): Promise<SightengineMLResponse | null> {
    const data = new FormData();
    data.append('text', text);
    data.append('lang', config.language || 'en');
    data.append('models', config.mlModels?.join(',') || '');
    data.append('mode', 'ml');
    data.append('api_user', SIGHTENGINE_API_USER!);
    data.append('api_secret', SIGHTENGINE_API_SECRET!);

    const response = await axios({
      url: SIGHTENGINE_API_URL,
      method: 'post',
      data: data,
      headers: data.getHeaders(),
      timeout: 10000
    });

    return response.data.status === 'success' ? response.data : null;
  }

  /**
   * Process rule-based moderation response
   */
  private processRuleBasedResponse(response: SightengineRuleBasedResponse): SafetyViolation[] {
    const violations: SafetyViolation[] = [];

    // Process profanity matches
    if (response.profanity?.matches) {
      response.profanity.matches.forEach(match => {
        const severity = this.mapIntensityToSeverity(match.intensity);
        violations.push({
          type: `profanity_${match.type}`,
          severity,
          confidence: 1.0,
          description: `Profanity detected: ${match.type} (${match.intensity})`,
          category: 'rule-based',
          action: severity === ViolationSeverity.CRITICAL ? 'block' : 'flag'
        });
      });
    }

    // Process personal information matches
    if (response.personal?.matches) {
      response.personal.matches.forEach(match => {
        violations.push({
          type: `personal_${match.type}`,
          severity: ViolationSeverity.HIGH,
          confidence: 1.0,
          description: `Personal information detected: ${match.type}`,
          category: 'rule-based',
          action: 'block'
        });
      });
    }

    // Process link matches
    if (response.link?.matches) {
      response.link.matches.forEach(match => {
        violations.push({
          type: 'external_link',
          severity: ViolationSeverity.MEDIUM,
          confidence: 1.0,
          description: 'External link detected',
          category: 'rule-based',
          action: 'flag'
        });
      });
    }

    // Process other category matches
    const otherCategories = ['drug', 'weapon', 'spam', 'content-trade', 'money-transaction',
                           'extremism', 'violence', 'self-harm', 'medical'];

    otherCategories.forEach(category => {
      if (response[category]?.matches) {
        response[category].matches.forEach((match: any) => {
          const severity = this.getCategorySeverity(category);
          violations.push({
            type: category,
            severity,
            confidence: 1.0,
            description: `${category} content detected`,
            category: 'rule-based',
            action: severity === ViolationSeverity.CRITICAL ? 'block' : 'moderate'
          });
        });
      }
    });

    return violations;
  }

  /**
   * Process ML-based moderation response
   */
  private processMLResponse(response: SightengineMLResponse, threshold: number): SafetyViolation[] {
    const violations: SafetyViolation[] = [];
    const classes = response.moderation_classes;

    Object.keys(classes).forEach(key => {
      if (key === 'available') return;

      const score = classes[key] as number;
      if (score > threshold) {
        const severity = this.scoresToSeverity(score);
        violations.push({
          type: `ml_${key}`,
          severity,
          confidence: score,
          description: `ML detected ${key} content (confidence: ${(score * 100).toFixed(1)}%)`,
          category: 'ml-based',
          action: severity === ViolationSeverity.CRITICAL ? 'block' : 'moderate'
        });
      }
    });

    return violations;
  }

  /**
   * Map Sightengine intensity to severity
   */
  private mapIntensityToSeverity(intensity: string): ViolationSeverity {
    switch (intensity.toLowerCase()) {
      case 'high':
        return ViolationSeverity.CRITICAL;
      case 'medium':
        return ViolationSeverity.HIGH;
      case 'low':
        return ViolationSeverity.MEDIUM;
      default:
        return ViolationSeverity.LOW;
    }
  }

  /**
   * Map scores to severity
   */
  private scoresToSeverity(score: number): ViolationSeverity {
    if (score >= 0.9) return ViolationSeverity.CRITICAL;
    if (score >= 0.8) return ViolationSeverity.HIGH;
    if (score >= 0.7) return ViolationSeverity.MEDIUM;
    return ViolationSeverity.LOW;
  }

  /**
   * Get category-specific severity
   */
  private getCategorySeverity(category: string): ViolationSeverity {
    const criticalCategories = ['extremism', 'violence', 'self-harm'];
    const highCategories = ['weapon', 'drug', 'content-trade', 'money-transaction'];
    const mediumCategories = ['spam', 'medical'];

    if (criticalCategories.includes(category)) return ViolationSeverity.CRITICAL;
    if (highCategories.includes(category)) return ViolationSeverity.HIGH;
    if (mediumCategories.includes(category)) return ViolationSeverity.MEDIUM;
    return ViolationSeverity.LOW;
  }

  /**
   * Check if user should be automatically sanctioned
   */
  shouldAutoSanction(violations: SafetyViolation[]): {
    shouldSanction: boolean;
    duration?: number; // minutes
    reason: string;
  } {
    const criticalCount = violations.filter(v => v.severity === ViolationSeverity.CRITICAL).length;
    const highCount = violations.filter(v => v.severity === ViolationSeverity.HIGH).length;
    const blockingCount = violations.filter(v => v.action === 'block').length;

    if (criticalCount > 0) {
      return {
        shouldSanction: true,
        duration: 24 * 60, // 24 hours
        reason: 'Critical safety violation detected'
      };
    }

    if (highCount >= 2) {
      return {
        shouldSanction: true,
        duration: 4 * 60, // 4 hours
        reason: 'Multiple high-severity violations detected'
      };
    }

    if (blockingCount >= 3) {
      return {
        shouldSanction: true,
        duration: 2 * 60, // 2 hours
        reason: 'Repeated policy violations'
      };
    }

    return {
      shouldSanction: false,
      reason: 'No automatic sanctions required'
    };
  }
}

// Export singleton instance
export const safetyService = new SafetyService();