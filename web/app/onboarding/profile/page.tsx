'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { config } from '@speakpoly/config';
import type { LanguageCode, TimeSlot } from '@speakpoly/types';

const profileSchema = z.object({
  nativeLanguages: z.array(z.string()).min(1, 'Select at least one native language'),
  fluentLanguages: z.array(z.string()).max(2, 'Maximum 2 fluent languages'),
  motives: z.array(z.string()).min(1, 'Select at least one motivation').max(2, 'Select up to 2 motivations'),
  interests: z.array(z.string()).min(3, 'Select at least 3 interests'),
  customInterests: z.string().optional(),
  timezone: z.string(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timeSlots = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
];

export default function ProfileSetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [availability, setAvailability] = useState<TimeSlot[]>([]);
  const [learningLanguage, setLearningLanguage] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nativeLanguages: [],
      fluentLanguages: [],
      motives: [],
      interests: [],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const selectedNative = watch('nativeLanguages');
  const selectedFluent = watch('fluentLanguages');
  const selectedMotives = watch('motives');
  const selectedInterests = watch('interests');

  useEffect(() => {
    // Get the learning language from the test
    fetch('/api/onboarding/language-test')
      .then(res => res.json())
      .then(data => {
        if (data.profile?.learningLanguage) {
          setLearningLanguage(data.profile.learningLanguage);
        }
      });
  }, []);

  const toggleAvailability = (day: number, hour: string) => {
    const slot: TimeSlot = {
      day: day as any,
      startTime: hour,
      endTime: `${parseInt(hour.split(':')[0]) + 1}:00`,
    };

    const existingIndex = availability.findIndex(
      s => s.day === day && s.startTime === hour
    );

    if (existingIndex >= 0) {
      setAvailability(availability.filter((_, i) => i !== existingIndex));
    } else {
      setAvailability([...availability, slot]);
    }
  };

  const isSlotSelected = (day: number, hour: string) => {
    return availability.some(s => s.day === day && s.startTime === hour);
  };

  const onSubmit = async (data: ProfileForm) => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (availability.length < 3) {
      toast.error('Please select at least 3 time slots for availability');
      return;
    }

    setIsLoading(true);

    try {
      // Process custom interests
      const customInterests = data.customInterests
        ? data.customInterests.split(',').map(i => i.trim()).filter(Boolean)
        : [];

      const response = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          customInterests,
          availability,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      // Track profile completion
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: config.analytics.events.PROFILE_COMPLETED,
        }),
      }).catch(() => {});

      toast.success('Profile completed successfully!');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">
              Complete Your Profile
            </h1>
            <p className="text-neutral-600">
              Tell us about yourself to find the perfect language partners
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Native Languages */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Native Language(s) *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {config.languages.supported.map((lang) => (
                  <label
                    key={lang}
                    className={`
                      flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all
                      ${selectedNative.includes(lang)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                      }
                      ${lang === learningLanguage ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <input
                      type="checkbox"
                      value={lang}
                      disabled={lang === learningLanguage}
                      {...register('nativeLanguages')}
                      className="sr-only"
                    />
                    <span className="text-xl">
                      {lang === 'en' && '🇬🇧'}
                      {lang === 'fr' && '🇫🇷'}
                      {lang === 'es' && '🇪🇸'}
                    </span>
                    <span className="font-medium">
                      {lang === 'en' && 'English'}
                      {lang === 'fr' && 'Français'}
                      {lang === 'es' && 'Español'}
                    </span>
                  </label>
                ))}
              </div>
              {errors.nativeLanguages && (
                <p className="mt-1 text-sm text-danger-500">{errors.nativeLanguages.message}</p>
              )}
            </div>

            {/* Fluent Languages */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Also Fluent In (Optional, max 2)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['de', 'it', 'pt'].map((lang) => (
                  <label
                    key={lang}
                    className={`
                      flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all
                      ${selectedFluent.includes(lang)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                      }
                      ${selectedFluent.length >= 2 && !selectedFluent.includes(lang)
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      value={lang}
                      disabled={selectedFluent.length >= 2 && !selectedFluent.includes(lang)}
                      {...register('fluentLanguages')}
                      className="sr-only"
                    />
                    <span className="font-medium">
                      {lang === 'de' && 'German'}
                      {lang === 'it' && 'Italian'}
                      {lang === 'pt' && 'Portuguese'}
                    </span>
                  </label>
                ))}
              </div>
              {errors.fluentLanguages && (
                <p className="mt-1 text-sm text-danger-500">{errors.fluentLanguages.message}</p>
              )}
            </div>

            {/* Motivations */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Why are you learning {learningLanguage.toUpperCase()}? (Choose 1-2) *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {config.motives.map((motive) => (
                  <label
                    key={motive}
                    className={`
                      flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all capitalize
                      ${selectedMotives.includes(motive)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                      }
                      ${selectedMotives.length >= 2 && !selectedMotives.includes(motive)
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      value={motive}
                      disabled={selectedMotives.length >= 2 && !selectedMotives.includes(motive)}
                      {...register('motives')}
                      className="sr-only"
                    />
                    {motive}
                  </label>
                ))}
              </div>
              {errors.motives && (
                <p className="mt-1 text-sm text-danger-500">{errors.motives.message}</p>
              )}
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Your Interests (Choose at least 3) *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {config.defaultInterests.map((interest) => (
                  <label
                    key={interest}
                    className={`
                      flex items-center justify-center p-2 text-sm border-2 rounded-lg cursor-pointer transition-all capitalize
                      ${selectedInterests.includes(interest)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      value={interest}
                      {...register('interests')}
                      className="sr-only"
                    />
                    {interest}
                  </label>
                ))}
              </div>
              {errors.interests && (
                <p className="mt-1 text-sm text-danger-500">{errors.interests.message}</p>
              )}

              <input
                type="text"
                placeholder="Add custom interests (comma-separated)"
                {...register('customInterests')}
                className="mt-3 input"
              />
            </div>

            <button
              type="submit"
              className="w-full btn-primary"
            >
              Continue to Availability →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 py-12">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Set Your Availability
          </h1>
          <p className="text-neutral-600">
            When are you available for language exchange? (Select at least 3 slots)
          </p>
          <p className="text-sm text-neutral-500 mt-2">
            Times shown in your timezone: {watch('timezone')}
          </p>
        </div>

        <div className="overflow-x-auto mb-6">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="text-left py-2 px-2 text-sm font-medium text-neutral-600">Time</th>
                {weekDays.map((day, index) => (
                  <th key={day} className="text-center py-2 px-1 text-sm font-medium text-neutral-600">
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time) => (
                <tr key={time}>
                  <td className="py-1 px-2 text-sm text-neutral-600">{time}</td>
                  {weekDays.map((_, dayIndex) => (
                    <td key={dayIndex} className="py-1 px-1">
                      <button
                        type="button"
                        onClick={() => toggleAvailability(dayIndex, time)}
                        className={`
                          w-full h-8 rounded transition-all
                          ${isSlotSelected(dayIndex, time)
                            ? 'bg-primary-500 hover:bg-primary-600'
                            : 'bg-neutral-100 hover:bg-neutral-200'
                          }
                        `}
                        aria-label={`${weekDays[dayIndex]} at ${time}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => setStep(1)}
            className="btn-outline"
          >
            ← Back
          </button>

          <span className="text-sm text-neutral-600">
            {availability.length} slots selected
          </span>

          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isLoading || availability.length < 3}
            className="btn-primary"
          >
            {isLoading ? 'Saving...' : 'Complete Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}