import { getWorkerIcon, getWorkerColor, availableIcons, availableColors } from '../workerUtils';
import { Server, Database, Cloud, Monitor, Cpu, MemoryStick, HardDriveIcon, Globe, Router, Network, Download, Upload, FileText, Music, Video, Image, Archive, Folder, Zap, Shield } from 'lucide-react';
import { QBittorrentIcon } from '../../components/ui/QBittorrentIcon';

describe('workerUtils', () => {
  describe('getWorkerIcon', () => {
    it('should return the correct icon for valid icon names', () => {
      expect(getWorkerIcon('Server')).toBe(Server);
      expect(getWorkerIcon('Database')).toBe(Database);
      expect(getWorkerIcon('Cloud')).toBe(Cloud);
      expect(getWorkerIcon('Monitor')).toBe(Monitor);
      expect(getWorkerIcon('Cpu')).toBe(Cpu);
      expect(getWorkerIcon('MemoryStick')).toBe(MemoryStick);
      expect(getWorkerIcon('HardDrive')).toBe(HardDriveIcon);
      expect(getWorkerIcon('Globe')).toBe(Globe);
      expect(getWorkerIcon('Router')).toBe(Router);
      expect(getWorkerIcon('Network')).toBe(Network);
      expect(getWorkerIcon('Download')).toBe(Download);
      expect(getWorkerIcon('Upload')).toBe(Upload);
      expect(getWorkerIcon('FileText')).toBe(FileText);
      expect(getWorkerIcon('Music')).toBe(Music);
      expect(getWorkerIcon('Video')).toBe(Video);
      expect(getWorkerIcon('Image')).toBe(Image);
      expect(getWorkerIcon('Archive')).toBe(Archive);
      expect(getWorkerIcon('Folder')).toBe(Folder);
      expect(getWorkerIcon('Zap')).toBe(Zap);
      expect(getWorkerIcon('Shield')).toBe(Shield);
      expect(getWorkerIcon('QBittorrent')).toBe(QBittorrentIcon);
    });

    it('should return Server as default for invalid icon names', () => {
      expect(getWorkerIcon('InvalidIcon')).toBe(Server);
      expect(getWorkerIcon(undefined)).toBe(Server);
      expect(getWorkerIcon('')).toBe(Server);
    });

    it('should handle case sensitivity correctly', () => {
      expect(getWorkerIcon('server')).toBe(Server); // Should be case sensitive
      expect(getWorkerIcon('SERVER')).toBe(Server); // Should be case sensitive
    });
  });

  describe('getWorkerColor', () => {
    it('should return the correct color for valid color names', () => {
      expect(getWorkerColor('Blue')).toBe('#3b82f6');
      expect(getWorkerColor('Green')).toBe('#10b981');
      expect(getWorkerColor('Purple')).toBe('#8b5cf6');
      expect(getWorkerColor('Red')).toBe('#ef4444');
      expect(getWorkerColor('Orange')).toBe('#f97316');
      expect(getWorkerColor('Pink')).toBe('#ec4899');
      expect(getWorkerColor('Indigo')).toBe('#6366f1');
      expect(getWorkerColor('Teal')).toBe('#14b8a6');
      expect(getWorkerColor('Yellow')).toBe('#eab308');
      expect(getWorkerColor('Gray')).toBe('#6b7280');
    });

    it('should return default blue color for invalid color names', () => {
      expect(getWorkerColor('InvalidColor')).toBe('#3b82f6');
      expect(getWorkerColor(undefined)).toBe('#3b82f6');
      expect(getWorkerColor('')).toBe('#3b82f6');
    });

    it('should handle case insensitive color names', () => {
      expect(getWorkerColor('blue')).toBe('#3b82f6');
      expect(getWorkerColor('BLUE')).toBe('#3b82f6');
      expect(getWorkerColor('Blue')).toBe('#3b82f6');
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
