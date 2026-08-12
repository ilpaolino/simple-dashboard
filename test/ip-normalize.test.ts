import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeClientIp } from '../lib/display/ipNormalize';

describe('normalizeClientIp', () => {
  it('strips IPv4-mapped IPv6 prefixes', () => {
    assert.equal(normalizeClientIp('::ffff:192.168.1.30'), '192.168.1.30');
  });

  it('trims whitespace and zone ids', () => {
    assert.equal(normalizeClientIp(' 192.168.1.30 '), '192.168.1.30');
    assert.equal(normalizeClientIp('fe80::1%eth0'), 'fe80::1');
  });
});
