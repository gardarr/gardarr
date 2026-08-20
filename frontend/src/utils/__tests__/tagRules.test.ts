import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseTag, scopeOf, deriveTags, type TagKind, type DeriveMode } from '../tagRules';

// Same fixture consumed by backend/internal/tagrules/tagrules_test.go, so
// the two implementations can't silently drift apart.
interface FixtureCase {
  name: string;
  input: string;
  kind: TagKind;
  key: string;
  value: string;
  raw: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, '../../../../tests/testdata/tag_rules.json');
const fixture: FixtureCase[] = JSON.parse(readFileSync(fixturePath, 'utf-8'));

describe('parseTag (shared fixture)', () => {
  it.each(fixture)('$name', (tc) => {
    const got = parseTag(tc.input);
    expect(got.kind).toBe(tc.kind);
    expect(got.key).toBe(tc.key);
    expect(got.value).toBe(tc.value);
    expect(got.raw).toBe(tc.raw);
  });
});

describe('scopeOf', () => {
  it('returns the scope key for a scoped tag', () => {
    expect(scopeOf('quality::4k')).toBe('quality');
  });

  it('returns null for a grouped tag', () => {
    expect(scopeOf('genre:action')).toBeNull();
  });

  it('returns null for a plain tag', () => {
    expect(scopeOf('movies')).toBeNull();
  });

  it('returns null when the scope is invalid (empty key)', () => {
    expect(scopeOf('::x')).toBeNull();
  });
});

// Same fixture consumed by backend/internal/tagrules/derive_test.go, so the
// two implementations can't silently drift apart.
interface DeriveFixtureCase {
  name: string;
  source: string;
  delimiter: string;
  mode?: DeriveMode | '';
  values: string[];
  expected?: string[];
  error?: boolean;
}

const deriveFixturePath = path.join(__dirname, '../../../../tests/testdata/tag_derive.json');
const deriveFixture: DeriveFixtureCase[] = JSON.parse(readFileSync(deriveFixturePath, 'utf-8'));

describe('deriveTags (shared fixture)', () => {
  it.each(deriveFixture)('$name', (tc) => {
    const mode = tc.mode || undefined;
    if (tc.error) {
      expect(() => deriveTags(tc.source, tc.delimiter, tc.values, mode)).toThrow();
      return;
    }
    expect(deriveTags(tc.source, tc.delimiter, tc.values, mode)).toEqual(tc.expected);
  });
});
