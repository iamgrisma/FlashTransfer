
const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SHIFT_SEQUENCE = [9, 2, 7, 4, 6];

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
 * Applies a substitution and transposition cipher to a 5-character code.
 * @param code The 5-character share code.
 * @returns The obfuscated code.
 */
export function obfuscateCode(code: string): string {
  if (code.length !== 5) {
    throw new Error('Code must be 5 characters long.');
  }

  // 1. Substitution Rule (Shift)
  const substituted = code.split('').map((char, index) => {
    const shift = SHIFT_SEQUENCE[index];
    const charIndex = ALPHANUMERIC.indexOf(char);
    
    if (charIndex === -1) {
        throw new Error('Invalid character in code.');
    }
    
    const newIndex = (charIndex - shift + ALPHANUMERIC.length) % ALPHANUMERIC.length;
    
    return ALPHANUMERIC[newIndex];
  });

  // 2. Transposition Rule (Swap)
  // Original positions: [0, 1, 2, 3, 4]
  // New positions from rule (1-based -> 0-based): [3, 0, 4, 1, 2]
  // Rule: 1->2, 2->4, 3->5, 4->1, 5->3
  const transposed = [
    substituted[3], // 4th char moves to 1st position
    substituted[0], // 1st char moves to 2nd position
    substituted[4], // 5th char moves to 3rd position
    substituted[1], // 2nd char moves to 4th position
    substituted[2], // 3rd char moves to 5th position
  ];

  return transposed.join('');
}


/**
 * Reverses the obfuscation process.
 * @param obfuscatedCode The obfuscated 5-character code.
 * @returns The original share code.
 */
export function reverseObfuscateCode(obfuscatedCode: string): string {
  if (obfuscatedCode.length !== 5) {
    throw new Error('Obfuscated code must be 5 characters long.');
  }

  const transposed = obfuscatedCode.split('');
  
  // 1. Reverse Transposition
  const substituted = [
    transposed[1], // char from 2nd pos moves back to 1st
    transposed[3], // char from 4th pos moves back to 2nd
    transposed[4], // char from 5th pos moves back to 3rd
    transposed[0], // char from 1st pos moves back to 4th
    transposed[2], // char from 3rd pos moves back to 5th
  ];

  // 2. Reverse Substitution
  const original = substituted.map((char, index) => {
    const shift = SHIFT_SEQUENCE[index];
    const charIndex = ALPHANUMERIC.indexOf(char);
    
    if (charIndex === -1) {
        throw new Error('Invalid character in obfuscated code.');
    }

    const newIndex = (charIndex + shift) % ALPHANUMERIC.length;
    return ALPHANUMERIC[newIndex];
  });

  return original.join('');
}
