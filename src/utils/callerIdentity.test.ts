// @ts-nocheck — run with `bun test src/utils/callerIdentity.test.ts`
import { describe, expect, test } from 'bun:test';
import { callerIdentity, formatCallerPhone, isRealCallerName } from './callerIdentity';

describe('isRealCallerName', () => {
  test('rejects API Submission placeholder (any case)', () => {
    expect(isRealCallerName('API Submission 2026-11-01')).toBe(false);
    expect(isRealCallerName('api submission')).toBe(false);
  });
  test('rejects Public Submission placeholder', () => {
    expect(isRealCallerName('  Public Submission abc')).toBe(false);
  });
  test('rejects empty / whitespace', () => {
    expect(isRealCallerName('   ')).toBe(false);
    expect(isRealCallerName(null)).toBe(false);
  });
  test('accepts a real name', () => {
    expect(isRealCallerName('Maria Lopez')).toBe(true);
  });
});

describe('formatCallerPhone', () => {
  test('10 digits', () => expect(formatCallerPhone('404-281-7603')).toBe('(404) 281-7603'));
  test('11 digits starting with 1', () => expect(formatCallerPhone('+1 404 281 7603')).toBe('(404) 281-7603'));
  test('other lengths keep trimmed original', () => expect(formatCallerPhone(' 12345 ')).toBe('12345'));
  test('empty is null', () => expect(formatCallerPhone('  ')).toBeNull());
});

describe('callerIdentity', () => {
  test('real name → name + formatted phone', () => {
    expect(callerIdentity({ name: 'Maria', phone: '4042817603' })).toEqual({ primary: 'Maria', secondary: '(404) 281-7603' });
  });
  test('placeholder name → phone, no secondary', () => {
    expect(callerIdentity({ name: 'API Submission x', phone: '14042817603' })).toEqual({ primary: '(404) 281-7603', secondary: null });
  });
  test('nothing → Unknown caller', () => {
    expect(callerIdentity({ name: 'Public Submission', phone: '' })).toEqual({ primary: 'Unknown caller', secondary: null });
  });
});
