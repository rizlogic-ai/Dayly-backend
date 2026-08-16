// Unit tests for src/services/openaiVoiceParser.js. Mocks `global.fetch`
// directly rather than hitting the real OpenAI API — no network call,
// no API key needed to run this suite. `env` is a plain mutable object
// (see src/config/env.js), so temporarily overriding env.openaiApiKey
// per-test is safe and needs no mocking library.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const env = require('../src/config/env');
const { classifyVoiceCommand, CREATABLE_MODULE_TYPES } = require('../src/services/openaiVoiceParser');

describe('CREATABLE_MODULE_TYPES', () => {
  test('excludes prayer (a locked/computed module, not voice-creatable) but includes task', () => {
    assert.equal(CREATABLE_MODULE_TYPES.includes('prayer'), false);
    assert.ok(CREATABLE_MODULE_TYPES.includes('task'));
    assert.ok(CREATABLE_MODULE_TYPES.includes('medicine'));
  });
});

describe('classifyVoiceCommand', () => {
  test('throws a 503 when OPENAI_API_KEY is not configured, without calling fetch', async () => {
    const originalKey = env.openaiApiKey;
    const originalFetch = global.fetch;
    env.openaiApiKey = null;
    global.fetch = async () => {
      throw new Error('fetch should not have been called');
    };
    try {
      await assert.rejects(
        () => classifyVoiceCommand({ transcript: 'hello', now: '2026-08-16T09:00:00.000Z' }),
        (err) => {
          assert.equal(err.status, 503);
          assert.equal(err.expose, true);
          return true;
        }
      );
    } finally {
      env.openaiApiKey = originalKey;
      global.fetch = originalFetch;
    }
  });

  test('sends the transcript/now/schema and returns the parsed JSON on success', async () => {
    const originalKey = env.openaiApiKey;
    const originalFetch = global.fetch;
    env.openaiApiKey = 'test-key';

    let capturedUrl;
    let capturedBody;
    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ intent: 'query', query: { scope: 'today' }, create: null }),
              },
            },
          ],
        }),
      };
    };

    try {
      const result = await classifyVoiceCommand({
        transcript: 'what do I have today',
        now: '2026-08-16T09:00:00.000Z',
      });

      assert.equal(capturedUrl, 'https://api.openai.com/v1/chat/completions');
      assert.equal(capturedBody.model, env.openaiModel);
      assert.equal(capturedBody.response_format.type, 'json_schema');
      assert.equal(capturedBody.response_format.json_schema.strict, true);
      // wantsSchedule lets the model flag "they want a real day/time,
      // they just didn't say one" (e.g. "schedule a grocery task")
      // separately from "this is genuinely a floating note" (e.g. "add
      // buy milk") — both end up schedule.type: "untimed" otherwise.
      assert.ok(
        capturedBody.response_format.json_schema.schema.properties.create.required.includes(
          'wantsSchedule'
        )
      );
      // remainingOnly distinguishes "what's remaining today" (only
      // not-yet-done items) from a full "what do I have today" recap.
      assert.ok(
        capturedBody.response_format.json_schema.schema.properties.query.required.includes(
          'remainingOnly'
        )
      );
      assert.match(capturedBody.messages[1].content, /what do I have today/);
      assert.match(capturedBody.messages[1].content, /2026-08-16T09:00:00\.000Z/);

      assert.deepEqual(result, { intent: 'query', query: { scope: 'today' }, create: null });
    } finally {
      env.openaiApiKey = originalKey;
      global.fetch = originalFetch;
    }
  });

  test('throws a 502 (not the raw upstream body) when OpenAI responds with an error status', async () => {
    const originalKey = env.openaiApiKey;
    const originalFetch = global.fetch;
    env.openaiApiKey = 'test-key';
    global.fetch = async () => ({ ok: false, status: 401, text: async () => 'unauthorized detail' });

    try {
      await assert.rejects(
        () => classifyVoiceCommand({ transcript: 'hello', now: '2026-08-16T09:00:00.000Z' }),
        (err) => {
          assert.equal(err.status, 502);
          assert.doesNotMatch(err.message, /unauthorized detail/);
          return true;
        }
      );
    } finally {
      env.openaiApiKey = originalKey;
      global.fetch = originalFetch;
    }
  });

  test('throws a 502 when OpenAI returns malformed JSON content', async () => {
    const originalKey = env.openaiApiKey;
    const originalFetch = global.fetch;
    env.openaiApiKey = 'test-key';
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    });

    try {
      await assert.rejects(
        () => classifyVoiceCommand({ transcript: 'hello', now: '2026-08-16T09:00:00.000Z' }),
        (err) => {
          assert.equal(err.status, 502);
          return true;
        }
      );
    } finally {
      env.openaiApiKey = originalKey;
      global.fetch = originalFetch;
    }
  });
});
