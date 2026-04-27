// Pure unit tests for primitives that don't need an HTTP server.
import './_env';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/auth/passwords';
import { signUserToken, signDisplayToken, verifyToken } from '../src/auth/jwt';
import { validatePassword } from '../src/auth/password-policy';
import { queryBool } from '../src/util/query';

describe('passwords', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('hola1234');
    assert.notEqual(hash, 'hola1234');
    assert.ok(await verifyPassword('hola1234', hash));
    assert.ok(!(await verifyPassword('wrong', hash)));
  });
});

describe('jwt', () => {
  it('signs and verifies a user token', () => {
    const token = signUserToken({ sub: 42, email: 'a@b.c', role: 'admin' });
    const payload = verifyToken(token);
    assert.equal(payload.sub, 42);
    assert.equal(payload.type, 'user');
    assert.equal(payload.role, 'admin');
  });

  it('signs a display token with the right type', () => {
    const token = signDisplayToken(7);
    const payload = verifyToken(token);
    assert.equal(payload.sub, 7);
    assert.equal(payload.type, 'display');
  });

  it('rejects a tampered token', () => {
    const token = signUserToken({ sub: 1, email: 'a@b.c', role: 'admin' });
    const broken = token.slice(0, -2) + 'xx';
    assert.throws(() => verifyToken(broken));
  });
});

describe('password policy', () => {
  it('rejects common weak passwords', () => {
    assert.equal(validatePassword('admin1234').ok, false);
  });

  it('accepts a basic strong-enough password', () => {
    assert.equal(validatePassword('carteleraOk2026').ok, true);
  });
});

describe('queryBool parser', () => {
  it('treats "false" as false', () => {
    assert.equal(queryBool.parse('false'), false);
    assert.equal(queryBool.parse('0'), false);
    assert.equal(queryBool.parse('no'), false);
  });

  it('treats "true" as true', () => {
    assert.equal(queryBool.parse('true'), true);
    assert.equal(queryBool.parse('1'), true);
    assert.equal(queryBool.parse('yes'), true);
  });

  it('rejects ambiguous strings', () => {
    assert.throws(() => queryBool.parse('maybe'));
  });
});
