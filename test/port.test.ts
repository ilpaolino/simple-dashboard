import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvalidPortError, parseHttpPort } from '../lib/port';
import { DEFAULT_HTTP_PORT, MAX_TCP_PORT, MIN_TCP_PORT } from '../lib/types';

describe('parseHttpPort', () => {
  it('accepts integer ports in range', () => {
    assert.equal(parseHttpPort(7999), 7999);
    assert.equal(parseHttpPort(MIN_TCP_PORT), MIN_TCP_PORT);
    assert.equal(parseHttpPort(MAX_TCP_PORT), MAX_TCP_PORT);
  });

  it('accepts numeric strings', () => {
    assert.equal(parseHttpPort('8080'), 8080);
    assert.equal(parseHttpPort(' 9000 '), 9000);
  });

  it('rejects invalid values', () => {
    assert.throws(() => parseHttpPort('abc'), InvalidPortError);
    assert.throws(() => parseHttpPort(80.5), InvalidPortError);
    assert.throws(() => parseHttpPort(0), InvalidPortError);
    assert.throws(() => parseHttpPort(70000), InvalidPortError);
    assert.throws(() => parseHttpPort(null), InvalidPortError);
    assert.throws(() => parseHttpPort(undefined), InvalidPortError);
  });

  it('keeps default constant at milestone value', () => {
    assert.equal(DEFAULT_HTTP_PORT, 7999);
  });
});
