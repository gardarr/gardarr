/**
 * Utility functions for generating test data
 */

/**
 * Generates a random email address for testing purposes
 * @param prefix Optional prefix for the email local part
 * @returns A random email address
 */
export function generateRandomEmail(prefix: string = 'test'): string {
  const randomId = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();
  return `${prefix}-${randomId}-${timestamp}@example.com`;
}

/**
 * Generates a random password for testing purposes
 * @param length Optional password length (default: 12)
 * @returns A random password string
 */
export function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each category
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // digit
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password to avoid predictable pattern
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

