import { describe, it, expect } from 'vitest';
import { generateRandomEmail, generateRandomPassword } from '../testUtils';

describe('testUtils', () => {
  describe('generateRandomEmail', () => {
    it('should generate a valid email address', () => {
      const email = generateRandomEmail();
      
      expect(email).toMatch(/^test-[a-z0-9]+-\d+@example\.com$/);
    });

    it('should generate unique emails on each call', () => {
      const email1 = generateRandomEmail();
      const email2 = generateRandomEmail();
      
      expect(email1).not.toBe(email2);
    });

    it('should use custom prefix when provided', () => {
      const email = generateRandomEmail('admin');
      
      expect(email).toMatch(/^admin-[a-z0-9]+-\d+@example\.com$/);
    });

    it('should generate emails with different prefixes', () => {
      const email1 = generateRandomEmail('user');
      const email2 = generateRandomEmail('admin');
      
      expect(email1).not.toBe(email2);
      expect(email1).toMatch(/^user-/);
      expect(email2).toMatch(/^admin-/);
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate a password with default length', () => {
      const password = generateRandomPassword();
      
      expect(password.length).toBe(12);
    });

    it('should generate a password with custom length', () => {
      const password = generateRandomPassword(16);
      
      expect(password.length).toBe(16);
    });

    it('should generate unique passwords on each call', () => {
      const password1 = generateRandomPassword();
      const password2 = generateRandomPassword();
      
      expect(password1).not.toBe(password2);
    });

    it('should contain at least one lowercase letter', () => {
      const password = generateRandomPassword();
      
      expect(password).toMatch(/[a-z]/);
    });

    it('should contain at least one uppercase letter', () => {
      const password = generateRandomPassword();
      
      expect(password).toMatch(/[A-Z]/);
    });

    it('should contain at least one digit', () => {
      const password = generateRandomPassword();
      
      expect(password).toMatch(/[0-9]/);
    });

    it('should contain at least one special character', () => {
      const password = generateRandomPassword();
      
      expect(password).toMatch(/[!@#$%^&*]/);
    });

    it('should generate passwords with minimum length of 8', () => {
      const password = generateRandomPassword(8);
      
      expect(password.length).toBe(8);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*]/);
    });
  });
});

