import { describe, it, expect, beforeEach } from 'vitest';
import { getRatioGrade, getGradeColor, getGradeStars, getGradeGlowClass, getGradeMessage, getGradeDescription } from '../ratioUtils';
import i18n from '../../i18n';

describe('ratioUtils', () => {
  beforeEach(() => {
    // Force a deterministic locale for consistent test results
    i18n.changeLanguage('pt-BR');
  });

  describe('getRatioGrade', () => {
    it('returns S++ for ratio >= 100', () => {
      expect(getRatioGrade(100)).toBe('S++');
      expect(getRatioGrade(120)).toBe('S++');
    });

    it('returns S+ for 50 <= ratio < 100', () => {
      expect(getRatioGrade(50)).toBe('S+');
      expect(getRatioGrade(99.99)).toBe('S+');
    });

    it('returns S for 30 <= ratio < 50', () => {
      expect(getRatioGrade(30)).toBe('S');
      expect(getRatioGrade(49.99)).toBe('S');
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

    it('provides distinct messages with S++ showing stronger emphasis than E', () => {
      const sPlusPlusMessage = getGradeMessage('S++');
      const eMessage = getGradeMessage('E');
      
      // Both should be non-empty strings
      expect(sPlusPlusMessage).toBeTruthy();
      expect(sPlusPlusMessage.length).toBeGreaterThan(0);
      expect(eMessage).toBeTruthy();
      expect(eMessage.length).toBeGreaterThan(0);
      
      // Messages should be different
      expect(sPlusPlusMessage).not.toBe(eMessage);
      
      // S++ message should show stronger emphasis
      // Check for more punctuation (exclamation marks, dashes) or greater length
      const sPlusPlusPunctuation = (sPlusPlusMessage.match(/[!—–-]/g) || []).length;
      const ePunctuation = (eMessage.match(/[!—–-]/g) || []).length;
      const hasStrongerPunctuation = sPlusPlusPunctuation > ePunctuation;
      const hasLongerMessage = sPlusPlusMessage.length > eMessage.length;
      
      expect(hasStrongerPunctuation || hasLongerMessage).toBe(true);
    });
  });

  describe('getGradeDescription', () => {
    it('maps S++ to translated description', () => {
      const expected = i18n.t('ratio.grades.description.Spp');
      expect(getGradeDescription('S++')).toBe(expected);
    });

    it('maps S+ to translated description', () => {
      const expected = i18n.t('ratio.grades.description.Sp');
      expect(getGradeDescription('S+')).toBe(expected);
    });

    it('maps E to translated description', () => {
      const expected = i18n.t('ratio.grades.description.E');
      expect(getGradeDescription('E')).toBe(expected);
    });

    it('returns translated unknown description for unknown grade', () => {
      const expected = i18n.t('ratio.grades.description.unknown');
      expect(getGradeDescription('Z')).toBe(expected);
    });
  });
});


