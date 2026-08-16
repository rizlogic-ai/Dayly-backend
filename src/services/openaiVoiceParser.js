// The only file that talks to OpenAI. Deliberately narrow: it classifies
// intent and extracts structured fields from a voice transcript, nothing
// more. It never sees the user's actual schedule/activity data — the
// Flutter client answers "what do I have today?" from its own local
// database using the `scope` this returns, so there's no way for the
// model to hallucinate a wrong appointment or invent data that isn't
// real. This is intent extraction only, never the source of truth for
// what's on the user's schedule.
const env = require('../config/env');
const { MODULE_TYPES } = require('../constants/moduleTypes');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// Prayer is excluded on purpose: it's a locked/computed module
// (ComputedDailyTimes, tied to location + calculation method), not
// something a free-form "create" command should be able to produce —
// same rule the client's on-device parser already followed.
const CREATABLE_MODULE_TYPES = MODULE_TYPES.filter((type) => type !== 'prayer');

const SYSTEM_PROMPT = `You are a precise command classifier for a personal scheduling app called Dayly. Given a voice transcript and the current date/time, decide exactly one intent:

- "query": the user is asking about their EXISTING schedule (e.g. "what do I have today", "summarize my day", "what's on my week", "how many things do I have planned"). This includes requests to summarize, list, or describe their day/week — those are queries, NOT new items to create.
- "create": the user wants to add a brand-new task, reminder, or activity (e.g. "remind me to...", "add...", "schedule...", "create a task to...").
- "unrecognized": neither of the above clearly applies.

For "query", set scope to "week" only if the user clearly means a multi-day/weekly view; otherwise default to "today".

For "create":
- "title": a short, clean description of the actual thing to do — never include trigger phrases ("remind me to", "add"), schedule/time/date words, or filler.
- "moduleType": exactly one of ${CREATABLE_MODULE_TYPES.join(', ')}. Default to "task" if no specific life-area is implied. Never output "prayer".
- "remindersRequested": true only if the user said something like "remind me" — a plain "add"/"create"/"schedule" without that wording is false.
- "schedule.type": one of "daily" (every day), "weekly" (specific weekday(s)), "everyNDays" (a cadence measured in days), "oneTime" (a single specific occurrence — a date and/or time was mentioned with no repeat cadence), or "untimed" (no date, time, or repeat cadence mentioned at all — a plain floating to-do).
- "schedule.times": every clock time mentioned, each as a 24-hour "HH:mm" string (e.g. "08:00", "20:30"). Empty array if none were mentioned.
- "schedule.weekdays": only meaningful when schedule.type is "weekly" — lowercase full weekday names ("monday".."sunday"). Empty array otherwise.
- "schedule.intervalDays": only meaningful when schedule.type is "everyNDays" — the integer N. Null otherwise.
- "schedule.date": only meaningful when schedule.type is "oneTime" — the resolved calendar date as "YYYY-MM-DD", computed from the current date/time given (resolve "tomorrow", weekday names, "on august 20", etc. yourself). Null otherwise (including for "untimed").

Only fill in "query" when intent is "query", and only fill in "create" when intent is "create" — the other must be null. Never invent details the transcript doesn't imply.`;

function buildSchema() {
  return {
    name: 'voice_command',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        intent: { type: 'string', enum: ['create', 'query', 'unrecognized'] },
        query: {
          type: ['object', 'null'],
          additionalProperties: false,
          properties: {
            scope: { type: 'string', enum: ['today', 'week'] },
          },
          required: ['scope'],
        },
        create: {
          type: ['object', 'null'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            moduleType: { type: 'string', enum: CREATABLE_MODULE_TYPES },
            remindersRequested: { type: 'boolean' },
            schedule: {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: {
                  type: 'string',
                  enum: ['daily', 'weekly', 'everyNDays', 'oneTime', 'untimed'],
                },
                times: { type: 'array', items: { type: 'string' } },
                weekdays: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                  },
                },
                intervalDays: { type: ['integer', 'null'] },
                date: { type: ['string', 'null'] },
              },
              required: ['type', 'times', 'weekdays', 'intervalDays', 'date'],
            },
          },
          required: ['title', 'moduleType', 'remindersRequested', 'schedule'],
        },
      },
      required: ['intent', 'query', 'create'],
    },
  };
}

/// Classifies one voice transcript. Throws with `.status`/`.expose` set
/// (matching this codebase's error-handling convention) on any failure —
/// missing API key, upstream error, or a malformed response.
async function classifyVoiceCommand({ transcript, now }) {
  if (!env.openaiApiKey) {
    const err = new Error('Voice parsing is not configured on this server yet.');
    err.status = 503;
    err.expose = true;
    throw err;
  }

  let response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: env.openaiModel,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Current date/time (ISO 8601): ${now}\nTranscript: "${transcript}"` },
        ],
        response_format: { type: 'json_schema', json_schema: buildSchema() },
      }),
    });
  } catch (err) {
    const wrapped = new Error('Could not reach OpenAI.');
    wrapped.status = 502;
    wrapped.expose = true;
    throw wrapped;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`OpenAI request failed (${response.status}): ${body.slice(0, 500)}`);
    const err = new Error('Voice parsing failed upstream.');
    err.status = 502;
    err.expose = true;
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error('OpenAI returned an empty response.');
    err.status = 502;
    err.expose = true;
    throw err;
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    const wrapped = new Error('OpenAI returned malformed JSON.');
    wrapped.status = 502;
    wrapped.expose = true;
    throw wrapped;
  }
}

module.exports = { classifyVoiceCommand, CREATABLE_MODULE_TYPES };
