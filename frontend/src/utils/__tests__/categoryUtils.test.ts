import { getCategoryIcon, getCategoryColor, availableIcons, availableColors } from '../categoryUtils';
import { Folder, Film, Tv } from 'lucide-react';

describe('categoryUtils', () => {
  describe('getCategoryIcon', () => {
    it('should return the correct icon for valid icon names', () => {
      expect(getCategoryIcon('Film')).toBe(Film);
      expect(getCategoryIcon('Tv')).toBe(Tv);
      expect(getCategoryIcon('Folder')).toBe(Folder);
    });

    it('should return Folder as default for invalid icon names', () => {
      expect(getCategoryIcon('InvalidIcon')).toBe(Folder);
      expect(getCategoryIcon(undefined)).toBe(Folder);
      expect(getCategoryIcon('')).toBe(Folder);
    });

    it('should handle case sensitivity correctly', () => {
      expect(getCategoryIcon('film')).toBe(Folder); // Should be case sensitive
      expect(getCategoryIcon('FILM')).toBe(Folder); // Should be case sensitive
    });
  });

  describe('getCategoryColor', () => {
    it('should return the correct color for valid color names', () => {
      expect(getCategoryColor('Blue')).toBe('#3b82f6');
      expect(getCategoryColor('Green')).toBe('#10b981');
      expect(getCategoryColor('Red')).toBe('#ef4444');
    });

    it('should return default blue color for invalid color names', () => {
      expect(getCategoryColor('InvalidColor')).toBe('#3b82f6');
      expect(getCategoryColor(undefined)).toBe('#3b82f6');
      expect(getCategoryColor('')).toBe('#3b82f6');
    });

    it('should handle case insensitive color names', () => {
      expect(getCategoryColor('blue')).toBe('#3b82f6');
      expect(getCategoryColor('BLUE')).toBe('#3b82f6');
      expect(getCategoryColor('Blue')).toBe('#3b82f6');
    });
  });

  describe('availableIcons', () => {
    it('should contain all expected icons', () => {
      const expectedIcons = [
        'Folder', 'FolderOpen', 'Film', 'Tv', 'Music', 'BookOpen',
        'Gamepad2', 'FileText', 'Image', 'Video', 'Download',
        'Star', 'Heart', 'Archive', 'Package', 'Disc'
      ];

      expectedIcons.forEach(iconName => {
        const icon = availableIcons.find(i => i.name === iconName);
        expect(icon).toBeDefined();
        expect(icon?.icon).toBeDefined();
      });
    });

    it('should have unique icon names', () => {
      const iconNames = availableIcons.map(i => i.name);
      const uniqueNames = new Set(iconNames);
      expect(iconNames.length).toBe(uniqueNames.size);
    });
  });

  describe('availableColors', () => {
    it('should contain all expected colors', () => {
      const expectedColors = [
        'Blue', 'Green', 'Purple', 'Red', 'Orange', 'Pink',
        'Indigo', 'Teal', 'Yellow', 'Gray'
      ];

      expectedColors.forEach(colorName => {
        const color = availableColors.find(c => c.name === colorName);
        expect(color).toBeDefined();
        expect(color?.value).toMatch(/^#[0-9a-fA-F]{6}$/); // Valid hex color
      });
    });

    it('should have unique color names', () => {
      const colorNames = availableColors.map(c => c.name);
      const uniqueNames = new Set(colorNames);
      expect(colorNames.length).toBe(uniqueNames.size);
    });

    it('should have unique color values', () => {
      const colorValues = availableColors.map(c => c.value);
      const uniqueValues = new Set(colorValues);
      expect(colorValues.length).toBe(uniqueValues.size);
    });
  });
});
