import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderWelcomePage } from '../lib/WelcomePage';

describe('renderWelcomePage', () => {
  it('includes required fields and escapes HTML', () => {
    const html = renderWelcomePage({
      clientIp: '192.168.1.10',
      userAgent: '<script>alert(1)</script>',
      method: 'GET',
      url: '/?x=1',
      timestamp: '2026-08-12T20:00:00.000Z',
    });

    assert.match(html, /<h1>Welcome Wall<\/h1>/);
    assert.match(html, /192\.168\.1\.10/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(html, />GET</);
    assert.match(html, /\/\?x=1/);
    assert.match(html, /2026-08-12T20:00:00\.000Z/);
  });
});
