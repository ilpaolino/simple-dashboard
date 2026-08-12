import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvalidIpError, isValidIpv4, parseIpv4 } from '../lib/ip/ipv4';

describe('parseIpv4', () => {
  it('accepts valid IPv4 addresses', () => {
    assert.equal(parseIpv4('192.168.1.50'), '192.168.1.50');
    assert.equal(parseIpv4(' 10.0.0.1 '), '10.0.0.1');
    assert.equal(parseIpv4('255.255.255.255'), '255.255.255.255');
    assert.equal(parseIpv4('0.0.0.0'), '0.0.0.0');
  });

  it('rejects invalid values', () => {
    assert.equal(isValidIpv4('192.168.1'), false);
    assert.equal(isValidIpv4('192.168.1.256'), false);
    assert.equal(isValidIpv4('localhost'), false);
    assert.throws(() => parseIpv4('not-an-ip'), InvalidIpError);
    assert.throws(() => parseIpv4(192), InvalidIpError);
    assert.throws(() => parseIpv4(null), InvalidIpError);
  });
});
