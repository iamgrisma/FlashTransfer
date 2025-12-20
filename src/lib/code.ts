const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generates a random 5-character alphanumeric string.
 */
export function generateShareCode(): string {
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += ALPHANUMERIC.charAt(Math.floor(Math.random() * ALPHANUMERIC.length));
  }
  return result;
}

/**
 * Simple encoding using a character rotation for obfuscation.
 * Much simpler than the previous substitution cipher.
 * @param code The 5-character share code.
 * @returns The encoded code.
 */
export function obfuscateCode(code: string): string {
  if (code.length !== 5) {
    throw new Error('Code must be 5 characters long.');
  }

  // Simple character rotation - rotate each character by its position  
  let encoded = '';
  for (let i = 0; i < code.length; i++) {
    const charIndex = ALPHANUMERIC.indexOf(code[i]);
    if (charIndex === -1) {
      throw new Error('Invalid character in code.');
    }

    // Rotate by position + 3 (simple offset)
    const newIndex = (charIndex + i + 3) % ALPHANUMERIC.length;
    encoded += ALPHANUMERIC[newIndex];
  }

  return encoded;
}

/**
 * Reverses the encoding process.
 * @param obfuscatedCode The encoded 5-character code.
 * @returns The original share code.
 */
export function reverseObfuscateCode(obfuscatedCode: string): string {
  if (obfuscatedCode.length !== 5) {
    throw new Error('Obfuscated code must be 5 characters long.');
  }

  // Reverse the character rotation
  let decoded = '';
  for (let i = 0; i < obfuscatedCode.length; i++) {
    const charIndex = ALPHANUMERIC.indexOf(obfuscatedCode[i]);
    if (charIndex === -1) {
      throw new Error('Invalid character in obfuscated code.');
    }

    // Reverse the rotation
    const originalIndex = (charIndex - i - 3 + ALPHANUMERIC.length) % ALPHANUMERIC.length;
    decoded += ALPHANUMERIC[originalIndex];
  }

  return decoded;
}
