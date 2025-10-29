// @ts-nocheck
import { getAgentIcon, getAgentColor, availableIcons, availableColors } from '../agentUtils';
import { Server, Database, Cloud, Monitor, Cpu, MemoryStick, HardDriveIcon, Globe, Router, Network, Download, Upload, FileText, Music, Video, Image, Archive, Folder, Zap, Shield } from 'lucide-react';
import { QBittorrentIcon } from '../../components/ui/QBittorrentIcon';

describe('agentUtils', () => {
  describe('getAgentIcon', () => {
    it('should return the correct icon for valid icon names', () => {
      expect(getAgentIcon('Server')).toBe(Server);
      expect(getAgentIcon('Database')).toBe(Database);
      expect(getAgentIcon('Cloud')).toBe(Cloud);
      expect(getAgentIcon('Monitor')).toBe(Monitor);
      expect(getAgentIcon('Cpu')).toBe(Cpu);
      expect(getAgentIcon('MemoryStick')).toBe(MemoryStick);
      expect(getAgentIcon('HardDrive')).toBe(HardDriveIcon);
      expect(getAgentIcon('Globe')).toBe(Globe);
      expect(getAgentIcon('Router')).toBe(Router);
      expect(getAgentIcon('Network')).toBe(Network);
      expect(getAgentIcon('Download')).toBe(Download);
      expect(getAgentIcon('Upload')).toBe(Upload);
      expect(getAgentIcon('FileText')).toBe(FileText);
      expect(getAgentIcon('Music')).toBe(Music);
      expect(getAgentIcon('Video')).toBe(Video);
      expect(getAgentIcon('Image')).toBe(Image);
      expect(getAgentIcon('Archive')).toBe(Archive);
      expect(getAgentIcon('Folder')).toBe(Folder);
      expect(getAgentIcon('Zap')).toBe(Zap);
      expect(getAgentIcon('Shield')).toBe(Shield);
      expect(getAgentIcon('QBittorrent')).toBe(QBittorrentIcon);
    });

    it('should return Server as default for invalid icon names', () => {
      expect(getAgentIcon('InvalidIcon')).toBe(Server);
      expect(getAgentIcon(undefined)).toBe(Server);
      expect(getAgentIcon('')).toBe(Server);
    });

    it('should handle case sensitivity correctly', () => {
      expect(getAgentIcon('server')).toBe(Server); // Should be case sensitive
      expect(getAgentIcon('SERVER')).toBe(Server); // Should be case sensitive
    });
  });

  describe('getAgentColor', () => {
    it('should return the correct color for valid color names', () => {
      expect(getAgentColor('Blue')).toBe('#3b82f6');
      expect(getAgentColor('Green')).toBe('#10b981');
      expect(getAgentColor('Purple')).toBe('#8b5cf6');
      expect(getAgentColor('Red')).toBe('#ef4444');
      expect(getAgentColor('Orange')).toBe('#f97316');
      expect(getAgentColor('Pink')).toBe('#ec4899');
      expect(getAgentColor('Indigo')).toBe('#6366f1');
      expect(getAgentColor('Teal')).toBe('#14b8a6');
      expect(getAgentColor('Yellow')).toBe('#eab308');
      expect(getAgentColor('Gray')).toBe('#6b7280');
    });

    it('should return default blue color for invalid color names', () => {
      expect(getAgentColor('InvalidColor')).toBe('#3b82f6');
      expect(getAgentColor(undefined)).toBe('#3b82f6');
      expect(getAgentColor('')).toBe('#3b82f6');
    });

    it('should handle case insensitive color names', () => {
      expect(getAgentColor('blue')).toBe('#3b82f6');
      expect(getAgentColor('BLUE')).toBe('#3b82f6');
      expect(getAgentColor('Blue')).toBe('#3b82f6');
    });
  });

  describe('availableIcons', () => {
    it('should contain all expected icons', () => {
      const expectedIcons = [
        'Server', 'Database', 'Cloud', 'Monitor', 'Cpu', 'MemoryStick',
        'HardDrive', 'Globe', 'Router', 'Network', 'Download', 'Upload',
        'FileText', 'Music', 'Video', 'Image', 'Archive', 'Folder',
        'Zap', 'Shield', 'QBittorrent'
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
