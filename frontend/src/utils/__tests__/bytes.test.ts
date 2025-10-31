import { describe, it, expect } from 'vitest';
import { formatBytes } from '../bytes';

describe('formatBytes', () => {
  it('returns 0 Bytes for 0 or negative', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(-1)).toBe('0 Bytes');
  });

  it('formats bytes to KB, MB, GB, TB correctly', () => {
    expect(formatBytes(1)).toBe('1.00 Bytes');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  it('formats large numbers with two decimals', () => {
    const twoPointFiveGB = 2.5 * 1024 * 1024 * 1024;
    expect(formatBytes(twoPointFiveGB)).toBe('2.50 GB');
  });
});


