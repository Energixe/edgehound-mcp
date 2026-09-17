import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { truncate, isValidEmail, monthlyPrice, parseDuration } from './user-utils.js';

describe('truncate', () => {
  // bnd-01
  it('returns empty string for empty input', () => {
    assert.equal(truncate('', 5), '');
  });

  // bnd-03
  it('returns empty string for null and undefined instead of throwing', () => {
    assert.equal(truncate(null, 5), '');
    assert.equal(truncate(undefined, 5), '');
    assert.equal(truncate(undefined, 0), '');
  });

  // bnd-02, str-10
  it('does not trim whitespace-only or padded strings', () => {
    assert.equal(truncate('   ', 10), '   ');
    assert.equal(truncate('  value  ', 20), '  value  ');
  });

  // bnd-05
  it('returns text unchanged when exactly maxLen (boundary, off-by-one)', () => {
    assert.equal(truncate('12345', 5), '12345');
  });

  // bnd-06
  it('appends ellipsis when one char over maxLen', () => {
    assert.equal(truncate('123456', 5), '12345…');
  });

  // bnd-05 / bnd-07
  it('handles maxLen of 0 with nonempty text without infinite ellipsis growth', () => {
    assert.equal(truncate('hello', 0), '…');
  });

  // bnd-06: maxLen 1
  it('maxLen 1 keeps one char plus ellipsis', () => {
    assert.equal(truncate('ab', 1), 'a…');
  });

  // bnd-07: oversized payload
  it('truncates a 10,000-character string to maxLen + ellipsis', () => {
    const big = 'x'.repeat(10000);
    const out = truncate(big, 50);
    assert.equal(out.length, 51);
    assert.ok(out.startsWith('x'.repeat(50)));
    assert.ok(out.endsWith('…'));
  });

  // bnd-08
  it('does not crash on a number where a string is expected (truthy path)', () => {
    assert.equal(truncate(12345, 3), '123…');
  });

  // bnd-09: "0" and "false" are non-empty strings
  it('treats stringly-false values as real strings', () => {
    assert.equal(truncate('false', 10), 'false');
    assert.equal(truncate('0', 1), '0');
  });

  // str-03: emoji / grapheme counting is by UTF-16 code unit
  it('truncates by code unit, splitting a multi-codepoint emoji', () => {
    const family = '👩🏽‍💻'; // surrogate pair + ZWJ sequence
    const out = truncate('👩🏽‍💻profile', 2);
    assert.equal(out, family.slice(0, 2) + '…');
    assert.equal(out.length, 3);
    assert.ok(!out.includes('💻'));
  });
});

describe('isValidEmail', () => {
  it('accepts a plain valid email', () => {
    assert.equal(isValidEmail('jane.doe@example.com'), true);
  });

  // str-01
  it('rejects plus-addressed email despite regex allowing plus sign', () => {
    assert.equal(isValidEmail('user+tag@example.com'), false);
  });

  // str-11
  it('rejects uppercase emails — regex has no i flag (case bug hunt)', () => {
    assert.equal(isValidEmail('User@Example.com'), false);
    assert.equal(isValidEmail('john.smith@Gmail.com'), false);
  });

  // bnd-01
  it('rejects empty string', () => {
    assert.equal(isValidEmail(''), false);
  });

  // bnd-02
  it('rejects whitespace-only input', () => {
    assert.equal(isValidEmail('   '), false);
  });

  // bnd-10 against isValidEmail's structure: plus anywhere kills it, including innocent names
  it('rejects apostrophe names (plus-like char class edge) and hyphen-only TLD tricks', () => {
    assert.equal(isValidEmail("o'neil@example.com"), false); // apostrophe not in charset
    assert.equal(isValidEmail('jean-luc@example.co.uk'), true);
  });

  // bnd-03
  it('throws on null/undefined input due to includes on non-string', () => {
    assert.throws(() => isValidEmail(null), TypeError);
    assert.throws(() => isValidEmail(undefined), TypeError);
  });

  // bnd-08
  it('rejects/throws on wrong primitive types', () => {
    assert.throws(() => isValidEmail(12345), TypeError);
  });

  // str-10
  it('rejects emails with leading/trailing whitespace (no trimming)', () => {
    assert.equal(isValidEmail('  jane@example.com  '), false);
  });

  it('rejects email with no TLD', () => {
    assert.equal(isValidEmail('jane@example'), false);
  });

  it('rejects single-char TLD (minimum boundary)', () => {
    assert.equal(isValidEmail('jane@example.c'), false);
  });

  it('accepts two-char TLD at exact minimum boundary', () => {
    assert.equal(isValidEmail('jane@example.co'), true);
  });

  it('rejects missing local part', () => {
    assert.equal(isValidEmail('@example.com'), false);
  });

  it('rejects missing domain dot', () => {
    assert.equal(isValidEmail('jane@examplecom'), false);
  });

  // sec-02: markup passes charset but still "valid" — no sanitizer is implied, verify no throw
  it('does not throw on script-tag payload (charset rejection, no crash)', () => {
    assert.doesNotThrow(() => isValidEmail('<script>alert(1)</script>@example.com'));
  });

  // str-09: newline injection attempt
  it('rejects CRLF injection attempt in local part', () => {
    assert.equal(isValidEmail('jane\r\n@example.com'), false);
  });

  // str-15: percent-encoded value is not decoded
  it('treats percent-encoded @ differently from real @', () => {
    assert.equal(isValidEmail('jane%40example.com'), false);
  });
});

describe('monthlyPrice', () => {
  // num-05 / num-04: float drift
  it('produces exact float for a whole-cents annual plan dividing cleanly', () => {
    assert.equal(monthlyPrice(120000), 100);
  });

  it('exposes float drift for non-divisible cents (0.1+0.2 class bug)', () => {
    // 1999 / 12 / 100 is not representable exactly
    const out = monthlyPrice(1999);
    assert.equal(out, (1999 / 12) / 100);
    assert.notEqual(out, 1.6583333333333334 * 1, 'should not silently equal rounded value');
    assert.ok(Math.abs(out - 1.6583333333333333) < 1e-15);
  });

  // num-05: rounding decision is not made — caller gets raw float
  it('returns unrounded repeating decimal for 2.005-style half-value inputs', () => {
    assert.equal(monthlyPrice(2005), 16.708333333333332);
    assert.notEqual(monthlyPrice(2005), 16.71); // no rounding is performed
  });

  // num-01: zero annual price is a valid price of zero, not absence
  it('returns 0 for zero annual cents', () => {
    assert.equal(monthlyPrice(0), 0);
  });

  // num-02
  it('returns negative price for negative input (allows refunds?)', () => {
    assert.equal(monthlyPrice(-12000), -100);
  });

  // num-03
  it('maps -0 input to -0 result without NaN', () => {
    const out = monthlyPrice(-0);
    assert.equal(Object.is(out, -0), true);
  });

  // num-14: months boundary — 12 is default, 1 yields full annual price
  it('divides by 1 month giving full annual amount', () => {
    assert.equal(monthlyPrice(120000, 1), 1200);
  });

  it('divides by a fractional month count (short billing cycle)', () => {
    assert.equal(monthlyPrice(120000, 11.5), (120000 / 11.5) / 100);
  });

  // num-13
  it('produces negative cents from negative months and reversed sign pairs', () => {
    assert.equal(monthlyPrice(120000, -2), -600);
    assert.equal(monthlyPrice(-120000, -2), 600);
  });

  // num-09
  it('returns Infinity when months is 0, not an error', () => {
    assert.equal(monthlyPrice(120000, 0), Infinity);
  });

  // num-07
  it('propagates NaN through to the result', () => {
    assert.equal(Object.is(monthlyPrice(NaN), NaN), true);
  });

  // num-08
  it('handles Infinity and -Infinity inputs', () => {
    assert.equal(monthlyPrice(Infinity), Infinity);
    assert.equal(monthlyPrice(-Infinity), -Infinity);
  });

  // num-11
  it('preserves very small decimal results', () => {
    assert.equal(monthlyPrice(1), 1 / 12 / 100);
    assert.ok(monthlyPrice(1) > 0);
  });

  // num-12: string annual cents coerces via /
  it('coerces numeric strings silently (or keeps as-is) — document actual behavior', () => {
    assert.equal(monthlyPrice('120000'), 100);
  });

  // num-06
  it('loses precision beyond MAX_SAFE_INTEGER', () => {
    const huge = 9007199254740993; // MAX_SAFE_INTEGER + 1
    const out = monthlyPrice(huge, 1);
    assert.equal(out, huge / 1 / 100);
    assert.notDeepStrictEqual(out, 90071992547409.93, 'float storage cannot represent this exactly');
  });
});

describe('parseDuration', () => {
  it('parses plain seconds', () => {
    assert.equal(parseDuration('30s'), 30);
  });

  it('parses minutes including 90m = 5400 (time-13, no rounding to hours)', () => {
    assert.equal(parseDuration('90m'), 5400);
    assert.equal(parseDuration('60m'), 3600);
  });

  it('parses hours and a mixed 1h30m input', () => {
    assert.equal(parseDuration('1h'), 3600);
    assert.equal(parseDuration('1h30m'), 5400); // only FIRST match used: 1h, then unit h
    assert.equal(parseDuration('2h'), 7200);
  });

  it('double-submits produce deterministic repeat values (conc-02 analogue)', () => {
    assert.equal(parseDuration('45m'), parseDuration('45m'));
  });

  // bnd-01
  it('returns 0 for empty string', () => {
    assert.equal(parseDuration(''), 0);
  });

  // bnd-03 + str-09: throws on null/undefined via .match on non-string
  it('throws TypeError on null and undefined input instead of returning 0', () => {
    assert.throws(() => parseDuration(null), TypeError);
    assert.throws(() => parseDuration(undefined), TypeError);
  });

  // bnd-08
  it('throws on number input (no string coercion)', () => {
    assert.throws(() => parseDuration(60), TypeError);
  });

  // bnd-06: zero durations
  it('parses 0s as zero seconds', () => {
    assert.equal(parseDuration('0s'), 0);
    assert.equal(parseDuration('0m'), 0);
    assert.equal(parseDuration('0h'), 0);
  });

  // bnd-02
  it('rejects whitespace-padded durations (no anchor/trailing handling)', () => {
    assert.equal(parseDuration(' 30m'), 1800); // match finds it anyway — silent leading junk accepted
    assert.equal(parseDuration('30m '), 1800); // ...and trailing junk too
  });

  // bnd-09: stringly-typed numeric input
  it('treats "60" (unitless) as invalid, returning 0', () => {
    assert.equal(parseDuration('60'), 0);
  });

  it('ignores unsupported units silently', () => {
    assert.equal(parseDuration('5x'), 0);
    assert.equal(parseDuration('10d'), 0);
  });

  it('ignores trailing extra tokens beyond the first match', () => {
    assert.equal(parseDuration('2m30s'), 120); // 30s silently dropped
  });

  it('takes the first valid token out of garbage', () => {
    assert.equal(parseDuration('junk!1h junk 2m'), 3600);
  });

  // bnd-07: very large values — parseInt handles big digits
  it('parses a very large hour count without overflow to garbage', () => {
    const big = '999999999';
    assert.equal(parseDuration(`${big}h`), 999999999 * 3600);
  });

  // num-06
  it('is not exact beyond MAX_SAFE_INTEGER seconds', () => {
    assert.equal(parseDuration('9007199254740993s'), 9007199254740993);
  });

  // sec-01
  it('does not crash or execute on SQL/command injection payloads', () => {
    assert.equal(parseDuration("'; DROP TABLE users; --"), 0);
    assert.equal(parseDuration('; rm -rf /'), 0);
    assert.equal(parseDuration('1s; rm -rf /'), 1); // leading valid token + trailing junk
  });

  it('matches the second unit if first is unsupported but later token valid', () => {
    assert.equal(parseDuration('5x2s'), 2);
  });
});