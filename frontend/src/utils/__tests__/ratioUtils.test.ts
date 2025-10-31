import { describe, it, expect } from 'vitest';
import { getRatioGrade, getGradeColor, getGradeStars, getGradeGlowClass, getGradeMessage, getGradeDescription } from '../ratioUtils';

describe('ratioUtils', () => {
  describe('getRatioGrade', () => {
    it('returns S++ for ratio >= 60', () => {
      expect(getRatioGrade(60)).toBe('S++');
      expect(getRatioGrade(120)).toBe('S++');
    });

    it('returns S+ for 45 <= ratio < 60', () => {
      expect(getRatioGrade(45)).toBe('S+');
      expect(getRatioGrade(59.99)).toBe('S+');
    });

    it('returns S for 30 <= ratio < 45', () => {
      expect(getRatioGrade(30)).toBe('S');
      expect(getRatioGrade(44.99)).toBe('S');
    });

    it('returns A for 15 <= ratio < 30', () => {
      expect(getRatioGrade(15)).toBe('A');
      expect(getRatioGrade(29.99)).toBe('A');
    });

    it('returns B for 7 <= ratio < 15', () => {
      expect(getRatioGrade(7)).toBe('B');
      expect(getRatioGrade(14.99)).toBe('B');
    });

    it('returns C for 3 <= ratio < 7', () => {
      expect(getRatioGrade(3)).toBe('C');
      expect(getRatioGrade(6.99)).toBe('C');
    });

    it('returns D for 1 <= ratio < 3', () => {
      expect(getRatioGrade(1)).toBe('D');
      expect(getRatioGrade(2.99)).toBe('D');
    });

    it('returns E for ratio < 1', () => {
      expect(getRatioGrade(0.99)).toBe('E');
      expect(getRatioGrade(0)).toBe('E');
      expect(getRatioGrade(-5)).toBe('E');
    });
  });

  describe('getGradeColor', () => {
    it('returns distinct color classes for all grades', () => {
      const grades = ['S++', 'S+', 'S', 'A', 'B', 'C', 'D', 'E'];
      const colors = grades.map(g => getGradeColor(g));
      // Colors should all be non-empty strings
      colors.forEach(c => expect(typeof c).toBe('string'));
      colors.forEach(c => expect(c.length).toBeGreaterThan(0));
    });

    it('returns muted style for unknown grade', () => {
      expect(getGradeColor('Z')).toContain('bg-muted');
    });
  });

  describe('getGradeStars', () => {
    it('maps grades to star counts 0-5', () => {
      expect(getGradeStars('S++')).toBeGreaterThanOrEqual(0);
      expect(getGradeStars('S++')).toBeLessThanOrEqual(5);
      expect(getGradeStars('S+')).toBeGreaterThanOrEqual(0);
      expect(getGradeStars('S+')).toBeLessThanOrEqual(5);
      expect(getGradeStars('S')).toBeGreaterThanOrEqual(0);
      expect(getGradeStars('S')).toBeLessThanOrEqual(5);
      expect(getGradeStars('A')).toBe(3);
      expect(getGradeStars('B')).toBe(2);
      expect(getGradeStars('C')).toBe(1);
      expect(getGradeStars('D')).toBe(1);
      expect(getGradeStars('E')).toBe(0);
    });
  });

  describe('getGradeGlowClass', () => {
    it('returns a non-empty class for A or higher', () => {
      expect(getGradeGlowClass('A')).not.toBe('');
      expect(getGradeGlowClass('S')).not.toBe('');
      expect(getGradeGlowClass('S+')).not.toBe('');
      expect(getGradeGlowClass('S++')).not.toBe('');
    });

    it('returns empty string for grades below A', () => {
      expect(getGradeGlowClass('B')).toBe('');
      expect(getGradeGlowClass('C')).toBe('');
      expect(getGradeGlowClass('D')).toBe('');
      expect(getGradeGlowClass('E')).toBe('');
    });
  });

  describe('getGradeMessage', () => {
    it('returns a friendly, non-empty message for each known grade', () => {
      const grades = ['S++', 'S+', 'S', 'A', 'B', 'C', 'D', 'E'];
      for (const g of grades) {
        const msg = getGradeMessage(g);
        expect(typeof msg).toBe('string');
        expect(msg.length).toBeGreaterThan(0);
      }
    });

    it('emphasizes heroism for S++ and encouragement for E', () => {
      const epic = getGradeMessage('S++').toLowerCase();
      const gentle = getGradeMessage('E').toLowerCase();
      expect(epic.includes('herói') || epic.includes('épico')).toBe(true);
      expect(gentle.includes('compart') || gentle.includes('ajuda')).toBe(true);
    });
  });

  describe('getGradeDescription', () => {
    it('maps S++ to LENDÁRIO', () => {
      expect(getGradeDescription('S++')).toBe('LENDÁRIO');
    });

    it('maps S+ to INCRÍVEL', () => {
      expect(getGradeDescription('S+')).toBe('INCRÍVEL');
    });

    it('maps E to INICIANTE', () => {
      expect(getGradeDescription('E')).toBe('INICIANTE');
    });

    it('returns DESCONHECIDO for unknown grade', () => {
      expect(getGradeDescription('Z')).toBe('DESCONHECIDO');
    });
  });
});


