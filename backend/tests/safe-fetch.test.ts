import './_env';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  validateUrl,
  isAlwaysBlockedIp,
  isPrivateIp,
  isCloudMetadataIp,
  safeFetch,
  SafeFetchError,
  assertHttpUrl,
} from '../src/util/safe-fetch';

describe('safe-fetch: validateUrl', () => {
  it('accepts http and https URLs', () => {
    assert.equal(validateUrl('http://example.com/x').protocol, 'http:');
    assert.equal(validateUrl('https://example.com/x').protocol, 'https:');
  });

  it('rejects file: URLs', () => {
    assert.throws(() => validateUrl('file:///etc/passwd'), (e: any) => e instanceof SafeFetchError && e.code === 'bad_scheme');
  });

  it('rejects javascript: URLs', () => {
    assert.throws(() => validateUrl('javascript:alert(1)'), (e: any) => e instanceof SafeFetchError && e.code === 'bad_scheme');
  });

  it('rejects ftp:// URLs', () => {
    assert.throws(() => validateUrl('ftp://example.com'), (e: any) => e instanceof SafeFetchError && e.code === 'bad_scheme');
  });

  it('rejects URLs with embedded credentials', () => {
    assert.throws(() => validateUrl('https://user:pass@example.com/'), (e: any) => e instanceof SafeFetchError && e.code === 'has_credentials');
  });

  it('rejects malformed URLs', () => {
    assert.throws(() => validateUrl('not-a-url'), (e: any) => e instanceof SafeFetchError && e.code === 'invalid_url');
  });
});

describe('safe-fetch: assertHttpUrl', () => {
  it('passes for http(s)', () => {
    assert.doesNotThrow(() => assertHttpUrl('http://example.com'));
    assert.doesNotThrow(() => assertHttpUrl('https://example.com/path'));
  });
  it('throws for non-http schemes', () => {
    assert.throws(() => assertHttpUrl('javascript:alert(1)'));
    assert.throws(() => assertHttpUrl('data:text/html,<script>'));
  });
});

describe('safe-fetch: IP classification', () => {
  it('flags cloud metadata IPs', () => {
    assert.equal(isCloudMetadataIp('169.254.169.254'), true);
    assert.equal(isCloudMetadataIp('169.254.170.2'), true);
    assert.equal(isCloudMetadataIp('169.254.0.1'), true);
  });

  it('always blocks unspecified, broadcast, multicast, link-local', () => {
    assert.equal(isAlwaysBlockedIp('0.0.0.0'), true);
    assert.equal(isAlwaysBlockedIp('255.255.255.255'), true);
    assert.equal(isAlwaysBlockedIp('169.254.169.254'), true);
    assert.equal(isAlwaysBlockedIp('224.0.0.1'), true);
    assert.equal(isAlwaysBlockedIp('239.255.255.255'), true);
    assert.equal(isAlwaysBlockedIp('::'), true);
    assert.equal(isAlwaysBlockedIp('ff02::1'), true);
  });

  it('does not flag normal public IPs', () => {
    assert.equal(isAlwaysBlockedIp('8.8.8.8'), false);
    assert.equal(isAlwaysBlockedIp('1.1.1.1'), false);
    assert.equal(isAlwaysBlockedIp('142.250.79.46'), false);
  });

  it('flags RFC1918 + loopback as private', () => {
    assert.equal(isPrivateIp('10.0.0.1'), true);
    assert.equal(isPrivateIp('127.0.0.1'), true);
    assert.equal(isPrivateIp('192.168.1.1'), true);
    assert.equal(isPrivateIp('172.16.0.1'), true);
    assert.equal(isPrivateIp('172.31.255.254'), true);
    assert.equal(isPrivateIp('::1'), true);
    assert.equal(isPrivateIp('fc00::1'), true);
    assert.equal(isPrivateIp('fe80::1'), true);
  });

  it('does not flag public IPs as private', () => {
    assert.equal(isPrivateIp('8.8.8.8'), false);
    assert.equal(isPrivateIp('172.32.0.1'), false);  // outside 16-31 range
    assert.equal(isPrivateIp('172.15.0.1'), false);
  });
});

describe('safe-fetch: HTTP behavior', () => {
  it('blocks fetching cloud metadata IP literal even with allowPrivate=true', async () => {
    await assert.rejects(
      safeFetch('http://169.254.169.254/latest/meta-data/'),
      (e: any) => e instanceof SafeFetchError && e.code === 'blocked_ip',
    );
  });

  it('blocks 127.0.0.1 when allowPrivate=false', async () => {
    await assert.rejects(
      safeFetch('http://127.0.0.1:1/anything', { allowPrivate: false }),
      (e: any) => e instanceof SafeFetchError && e.code === 'private_ip',
    );
  });

  it('blocks "localhost" hostname when allowPrivate=false', async () => {
    await assert.rejects(
      safeFetch('http://localhost:1/anything', { allowPrivate: false }),
      (e: any) => e instanceof SafeFetchError && (e.code === 'private_host' || e.code === 'private_ip'),
    );
  });

  it('rejects responses larger than maxBytes', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('x'.repeat(10_000));
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    try {
      await assert.rejects(
        safeFetch(`http://127.0.0.1:${port}/big`, { maxBytes: 100, allowPrivate: true }),
        (e: any) => e instanceof SafeFetchError && e.code === 'too_large',
      );
    } finally {
      server.close();
    }
  });

  it('returns ok response within size limits', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ hello: 'world' }));
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    try {
      const r = await safeFetch(`http://127.0.0.1:${port}/ok`, { allowPrivate: true });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json(), { hello: 'world' });
    } finally {
      server.close();
    }
  });

  it('re-validates target on redirect', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/redirect-to-meta') {
        res.writeHead(302, { location: 'http://169.254.169.254/' });
        return res.end();
      }
      res.writeHead(404).end();
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    try {
      await assert.rejects(
        safeFetch(`http://127.0.0.1:${port}/redirect-to-meta`, { allowPrivate: true }),
        (e: any) => e instanceof SafeFetchError && e.code === 'blocked_ip',
      );
    } finally {
      server.close();
    }
  });

  it('aborts when timeout elapses', async () => {
    const server = http.createServer((_req, res) => {
      // Hold the connection open
      setTimeout(() => res.end('late'), 1000);
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    try {
      await assert.rejects(
        safeFetch(`http://127.0.0.1:${port}/slow`, { timeoutMs: 50, allowPrivate: true }),
      );
    } finally {
      server.close();
    }
  });
});
