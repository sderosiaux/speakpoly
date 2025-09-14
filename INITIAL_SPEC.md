# PRD — Long-term Language Exchange Platform

## 1) Summary

A safe, global place to learn a language through real talks with native speakers who want to learn your language in return. The core is a stable pair. The match is strict native to learner on both sides. The product keeps talks on platform. The app is web first. Mobile comes later. AI supports, never leads.

## 2) Goals

* Build stable pairs that last weeks, not days.
* Help travelers and curious people speak a language from the inside: slang, culture, real life.
* Keep users safe and on platform.
* Keep the product simple and fast.

## 3) Non-goals

* No dating.
* No school-style courses or long lessons.
* No open “swipe” discovery.
* No moving chats to other apps.
* No heavy public scoring or leaderboards.

## 4) Target users

* Travelers and expats who want real talk with locals.
* People from A1 to C1 level.
* Pairs to start with: EN↔FR, FR↔ES, EN↔ES.
* Age 18 and up only.

## 5) Product principles

* Long term first. One strong pair beats ten weak matches.
* Measure acts, not opinions. Use real activity to guide the system.
* Low friction for learning. High guard for safety.
* On platform only. Block all contact sharing.
* AI as a light guide in the chat. Never in the way.
* Clear rules in plain words.

## 6) Core user value

* Find a native who learns your language.
* Talk often. Share culture.
* See clear progress: active hours, new words you read and say, themes you covered.

---

## 7) Scope — MVP

### 7.1 Onboarding

* Age gate: confirm 18+. If not, stop.
* Pseudonym by default. Unique check and filter for contact data in the name.
* Mini CEFR test 3 to 5 minutes: quick vocab, short reading or audio, self check. Output A1 to C1.
* Language profile:

  * One native language required.
  * Up to two languages may be marked as “fluent” in total (self-declared).
  * Learning language with level set from the mini test.
* Motives: choose 1 to 2 from a fixed list: travel, study, work, culture, exam, friendly exchange.
* Interests: pick tags from a set plus a few free tags.
* Availability: pick weekly time slots.

Acceptance

* Users complete all steps in under 5 minutes on a normal desktop.
* Mini test assigns A1 to C1 with >90 percent completion.
* Third “fluent” is blocked with a simple message.

Analytics

* sign\_up\_started, age\_gate\_passed|failed
* level\_test\_started|done, level\_assigned
* native\_lang\_set, fluent\_lang\_added, fluent\_lang\_limit\_blocked
* learning\_lang\_added, motive\_selected, interests\_selected, availability\_saved

### 7.2 Matching — strict native↔learner

* Main view “Compatible pairs”:

  * I am native in X and learn Y. Show people who are native in Y and learn X.
* Sort order:

  * Language compatibility flag.
  * Time overlap score from weekly slots.
  * Interest overlap (Jaccard over tags).
  * Close goals from motives.
  * Reliability score (private metric).
* Request flow: send up to N open requests at a time, where N = 3.
* If no reply in 72 hours: auto suggest 3 new options.
* Accept flow: on accept, create pair and open the chat.
* Soft goal shown at start: build a pair that lasts.

Acceptance

* List loads in under 1 second at P50, under 2 seconds at P90 with 1k candidates.
* Users can send a request with 1 click from the card.
* After 72 hours without reply, the system shows 3 fresh options.

Analytics

* match\_list\_viewed, match\_requested, match\_accepted, pair\_created
* match\_timeout\_72h, alt\_suggested

### 7.3 Conversation

* In-app text chat with emoji and safe attachments.
* Voice notes up to 2 minutes each.
* Audio calls in app. Video is out of MVP.
* Topic cards by AI: show 5 at start. Button “New topics” adds 3 more.
* Topic memory: mark topics covered to avoid repeats.
* Session summary: after each session, show new words, common mistakes, and a light task.

Acceptance

* Messages deliver in under 300 ms server-to-server P50.
* Voice notes send and play on web and low networks.
* Topic cards show within 1 second.
* Summary appears within 30 seconds after the session ends.

Analytics

* message\_sent, voice\_note\_sent, audio\_call\_started|ended
* ai\_topic\_cards\_shown, ai\_topic\_card\_used, topic\_marked\_done
* session\_summary\_generated, vocab\_items\_added

### 7.4 Engagement and continuity

* The platform does not set a fixed pace.
* Gentle nudge at day 5 of silence in a pair.
* If no reply by day 7, one-click rematch option with history kept.
* No hard cap on active pairs. The UI suggests 1 to 2 active pairs.

Acceptance

* A single reminder at day 5. No repeats unless the user asks.
* Rematch creates at least 3 fresh options within 5 seconds.

Analytics

* gentle\_nudge\_sent, rematch\_requested, rematch\_completed

### 7.5 Safety and on-platform only

* Block contact sharing: auto mask emails, phone numbers, social handles, QR codes.
* If the system masks a message, show a short notice to the sender.
* Repeat attempts trigger limits:

  * First event: auto warning.
  * Second event within 7 days: send limit for 24 hours.
  * Third event or severe case: ban.
* Detect risky content: sexual advances, harassment, scams.

  * Quarantine the message with blur.
  * Receiver can tap “show anyway.”
  * Easy report and block.

Acceptance

* Redaction works for common email and phone formats across top 20 countries.
* QR detection catches codes in images at 300 px or more.
* Safety checks add under 50 ms per message at P90.
* Mod console receives reports with full context and redactions in place.

Analytics

* contact\_redacted, offplatform\_attempt\_blocked
* safety\_flag\_triggered, message\_quarantined, report\_submitted, user\_banned

### 7.6 Identity over time

* Pseudonym by default.
* Offer “show real name” after both: 5 hours of talk and 2 weeks since pair start.
* Opt-in by both sides. Either side can revert.

Analytics

* real\_name\_offer\_shown, real\_name\_optin

### 7.7 Qualification by action — private only

Private scores that the user can see, not public.

* Consistency: active weeks in a row.
* Depth: total minutes, turns per session, talk balance.
* Reciprocity: language alternation and mutual corrections.
* Reliability: response time and no-show rate.
* On-platform share: percent of messages not blocked for contacts.
* Longevity: age of the pair with milestones at 2, 4, 8, 12 weeks.

Analytics

* quality\_scores\_updated, progress\_viewed

---

## 8) Scope — V1 and later

* Video calls in app.
* Spaced review for the user’s saved words.
* Tiny stable groups of 3 to 4 as an option.
* Real-time help on pronunciation.
* Guided “coach session” as an optional mode.

---

## 9) Success metrics

North Star

* Weekly hours of talk in stable pairs.

Product KPIs

* Hours per user per week.
* Pairs that reach 8+ weeks.
* Replies under 24 hours.
* On-platform ratio over 98 percent of messages.
* Safety reports per 1,000 messages.
* Share of pairs that do a rematch after 7 days of silence.

User progress shown in product

* Active hours.
* New words read and said.
* Themes covered.

---

## 10) User flows

### 10.1 New user

Landing → Age confirm → Pseudonym → Mini test → Languages → Motives → Interests → Availability → “Compatible pairs” → Send request → Accept → Chat opens.

### 10.2 Active pair

Open chat → Pick a topic card or start typing → Talk or send voice notes → End session → Summary shows → Next time, avoid old topics and build new ones.

### 10.3 Silence handling

Day 5: gentle nudge → Day 7: show rematch option → Keep history and move to a new match.

### 10.4 Safety

User types phone number → system masks it and shows a short notice → repeated attempts trigger limits → mod console can act.

---

## 11) Information architecture

* Home: “Compatible pairs” and your active pairs.
* Chat: messages, voice notes, call button, topic cards, topics history, vocab tab.
* Profile: languages, motives, interests, availability.
* Progress: private scores and user metrics.
* Safety center: rules, block list, reports.
* Settings: identity, data export, data delete, AI data opt-out.

---

## 12) Data model v1

User

* id, created\_at
* age\_verified\_18\_plus boolean
* pseudonym string
* real\_name string optional, hidden flag
* locale, country optional

LanguageProfile

* user\_id
* native\_languages \[code] min 1
* fluent\_languages \[code] max 2
* learning { code, level\_cefr, from\_test boolean }

Availability

* user\_id
* weekly\_slots: list of day + start + end in UTC

Interests

* user\_id
* tags \[string] with safe filter

Pair

* id, user\_a, user\_b
* start\_at, status: pending, active, silent, closed
* metrics: minutes\_total, turns\_total, language\_balance

Message

* id, pair\_id, sender\_id
* type: text, voice, system
* body, transcript, redactions \[]
* safety\_flags \[]

Session

* id, pair\_id, start, end, mode: text, audio, call
* topics\_covered \[id]
* summary\_id

Qualification

* user\_id
* consistency\_weeks, depth\_score, reciprocity\_score, reliability\_score, on\_platform\_rate, longevity\_weeks

SafetyEvent

* id, user\_id, type, severity, action\_taken, occurred\_at

Topic

* id, locale, tags\[], text, difficulty

Summary

* id, pair\_id, session\_id, new\_words\[], common\_mistakes\[], follow\_up\_task

---

## 13) Matching score v1

```
score =  w1*lang_compat
       + w2*time_overlap_minutes_norm
       + w3*interest_overlap_jaccard
       + w4*goal_match
       + w5*reliability_z
       + w6*longevity_intent
```

* lang\_compat: binary, native↔learner match both ways, else 0.
* time\_overlap\_minutes\_norm: 0 to 1 from weekly slot overlap.
* interest\_overlap\_jaccard: 0 to 1 over tags.
* goal\_match: 1 if at least one motive matches, else 0.
* reliability\_z: normalized reliability score.
* longevity\_intent: 1 if user accepts “long term” prompt during first match.

Tie-breakers

* Closer time zone, then shorter request queue.

---

## 14) Safety and policy details

Rules shown in product

* “Here we talk and share culture. No flirting.”
* “Stay on the app. No emails, phone numbers, handles, or codes.”

Contact redaction

* Regex and ML detect emails, phone numbers, social handles, and invite links.
* OCR on images to catch text.
* QR scan on images to block codes.

Risk content

* Classifiers for sexual talk, harassment, scams, violence.
* Blur by default with user choice to show.
* Easy block and report.

Sanctions

* 1st event: auto warning.
* 2nd in 7 days: 24 hour send limit.
* 3rd or severe: ban.

Moderator console

* Queue by severity.
* Redacted view and full context.
* Actions: warn, restrict, ban.

---

## 15) AI features

In chat

* Topic cards based on profile, level, and recent talks.
* Smart prompts to keep balance between languages.
* Real-time light nudge if one person talks only in one language.

After chat

* Short summary with new words, mistakes, and one small task.
* Save words to a list for later review.

Safety

* Classifiers score each message.
* Contact data detection and OCR.

Matchmaking

* Cold start boost using motives, interests, time, and level.

Guardrails

* No heavy grammar grading.
* No public scores from AI.
* Users can opt out of AI data use for model training.

---

## 16) Privacy and data

Data use

* We store text, transcripts, and audio to run topic cards, summaries, matches, and safety.
* Default retention: 12 months.
* Users can export or delete data.
* Users can opt out of AI training use. Core safety checks still run.

Compliance

* Age gate 18+.
* Clear privacy notice and terms.
* GDPR and UK GDPR: DSR, retention, and lawful basis documented.

---

## 17) Non-functional

Performance

* Chat send to receive under 300 ms P50, under 800 ms P90.
* Match list render under 1 second P50.
* Topic cards in under 1 second.
* Safety checks add under 50 ms P90 per message.

Reliability

* 99.9 percent monthly uptime for chat and auth.
* Graceful degrade for voice notes on weak networks.

Security

* All traffic over TLS.
* Encrypt data at rest.
* Rate limits on messaging and match requests.
* Audit log for mod actions.

Accessibility

* Baseline web a11y: keyboard nav, readable font, color contrast.
* Not a focus area for MVP beyond baseline.

---

## 18) Analytics — events and dashboards

Events

* sign\_up\_started, age\_gate\_passed|failed
* level\_test\_started|done, level\_assigned
* profile\_completed
* match\_list\_viewed, match\_requested, match\_accepted
* pair\_created, session\_started|ended
* message\_sent, voice\_note\_sent, audio\_call\_started|ended
* ai\_topic\_cards\_shown|used, topic\_marked\_done
* session\_summary\_generated, vocab\_items\_added
* contact\_redacted, offplatform\_attempt\_blocked
* safety\_flag\_triggered, message\_quarantined, report\_submitted, user\_banned
* gentle\_nudge\_sent, rematch\_requested, rematch\_completed
* progress\_viewed, quality\_scores\_updated
* real\_name\_offer\_shown, real\_name\_optin

Dashboards

* North Star: weekly hours in stable pairs.
* Retention 8 weeks.
* Reply time.
* On-platform rate.
* Safety events trend.
* New words saved per user.

---

## 19) UX copy — core lines

* Home hero: “Learn by talking with natives. Help them learn yours too.”
* Rules: “Here we talk and share culture. No flirting.”
* Contact block: “We hide contact details to keep you safe. Stay in the app.”
* Real name: “Show your real names after trust on both sides.”

Banned words in UI

* date, sexy, swipe.

Tone

* Warm. Calm. Light fun.

---

## 20) Launch plan

Phase 0 — Internal alpha

* Web only.
* EN↔FR to start.
* Manual mod and rule tuning.

Phase 1 — Closed beta

* Add FR↔ES and EN↔ES.
* Open waitlist.
* Add audio calls.
* Start day-5 nudge and day-7 rematch.

Phase 2 — Public beta

* Broader scale.
* Add video if needed.
* Improve matching weights from data.

---

## 21) Risks and responses

Risk: users try to move off platform early.
Response: strict redaction, clear notice, quick limits.

Risk: pairs stall after week 1.
Response: topic memory, fresh prompts, day-5 nudge, day-7 rematch.

Risk: the app drifts into dating.
Response: no open discovery, no “hot” feed, rules in UI, strong filters, quick bans.

Risk: AI feels heavy.
Response: opt-out for training, light touch in chat, no public scoring.

---

## 22) Open items to confirm

* Voice note max size and codec.
* Exact list of motive and interest tags for launch.
* N for open match requests per user after MVP.
* Video timing in V1 vs later.
* Language detection thresholds for “balance” nudges.
* Final weights for matching score.
* Country coverage for phone detection patterns at launch.

---

## 23) Acceptance tests — sample

Onboarding

* Given a new user, when they set a third “fluent,” then the system blocks it and shows a clear message.
* Given a new user who enters an email in their pseudonym, then the system rejects the name.

Matching

* Given a user native in FR and learning EN, when they open “Compatible pairs,” then all shown people are native EN and learning FR.
* Given no reply for 72 hours, then the system shows 3 new options.

Chat and AI

* Given an active pair, when they end a session, then a summary is available within 30 seconds and includes at least 5 new words or “none found.”

Safety

* Given a message with a phone number, then the app masks it before send and logs contact\_redacted.
* Given three blocked contact attempts in a week, then the user is banned.

Identity

* Given a pair with 5 hours and 2 weeks, when both accept, then real names display in the chat header.

---

## 24) Operational notes

Moderation

* Coverage 7 days a week during beta.
* SLA for urgent reports: under 4 hours.

Support

* In-app report and help center.
* No email chat allowed with other users.

Data

* Retain for 12 months by default.
* Offer export and delete in Settings.

---

This PRD folds in every decision we set: strict native to learner match, on-platform only, action-based metrics, age 18+, two max “fluent” languages, AI as a light helper, day-5 nudge and day-7 rematch, real name reveal after trust, free product, and a focus on EN, FR, ES to start.
