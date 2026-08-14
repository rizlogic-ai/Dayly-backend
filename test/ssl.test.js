const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { shouldUseSsl } = require('../src/utils/ssl');

describe('shouldUseSsl', () => {
  test('defaults off for localhost', () => {
    assert.equal(shouldUseSsl('postgres://user:pass@localhost:5433/dayly', undefined), false);
  });

  test('defaults off for 127.0.0.1', () => {
    assert.equal(shouldUseSsl('postgres://user:pass@127.0.0.1:5432/dayly', undefined), false);
  });

  test('defaults on for a remote host (e.g. Render Postgres)', () => {
    assert.equal(
      shouldUseSsl('postgres://user:pass@dpg-xxxx-a.oregon-postgres.render.com/dayly', undefined),
      true
    );
  });

  test('a connection string with no credentials still resolves the host correctly', () => {
    assert.equal(shouldUseSsl('postgres://localhost:5433/dayly', undefined), false);
  });

  test('PGSSL=true forces it on even for localhost', () => {
    assert.equal(shouldUseSsl('postgres://localhost:5433/dayly', 'true'), true);
  });

  test('PGSSL=false forces it off even for a remote host', () => {
    assert.equal(
      shouldUseSsl('postgres://dpg-xxxx-a.oregon-postgres.render.com/dayly', 'false'),
      false
    );
  });
});
