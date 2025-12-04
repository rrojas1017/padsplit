// Common weak passwords to block
const COMMON_PASSWORDS = [
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'admin', 'login',
  'passw0rd', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball',
  'dragon', 'master', 'monkey', 'shadow', 'michael', 'jennifer', 'jordan',
  'superman', 'batman', 'trustno1', 'hello', 'charlie', 'donald', 'password1!',
];

export interface PasswordRequirement {
  label: string;
  met: boolean;
  key: string;
}

export interface PasswordStrengthResult {
  score: number; // 0-4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  requirements: PasswordRequirement[];
  isValid: boolean;
}

export const hasMinLength = (password: string): boolean => password.length >= 8;
export const hasUppercase = (password: string): boolean => /[A-Z]/.test(password);
export const hasLowercase = (password: string): boolean => /[a-z]/.test(password);
export const hasNumber = (password: string): boolean => /\d/.test(password);
export const hasSpecialChar = (password: string): boolean => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
export const isNotCommon = (password: string): boolean => 
  !COMMON_PASSWORDS.includes(password.toLowerCase());

export function validatePassword(password: string): PasswordStrengthResult {
  const requirements: PasswordRequirement[] = [
    { key: 'length', label: 'At least 8 characters', met: hasMinLength(password) },
    { key: 'uppercase', label: 'One uppercase letter (A-Z)', met: hasUppercase(password) },
    { key: 'lowercase', label: 'One lowercase letter (a-z)', met: hasLowercase(password) },
    { key: 'number', label: 'One number (0-9)', met: hasNumber(password) },
    { key: 'special', label: 'One special character (!@#$%^&*)', met: hasSpecialChar(password) },
    { key: 'common', label: 'Not a common password', met: password.length > 0 ? isNotCommon(password) : true },
  ];

  const metCount = requirements.filter(r => r.met).length;
  const isValid = requirements.every(r => r.met);

  let score: number;
  let label: PasswordStrengthResult['label'];

  if (password.length === 0) {
    score = 0;
    label = 'Very Weak';
  } else if (metCount <= 2) {
    score = 0;
    label = 'Very Weak';
  } else if (metCount === 3) {
    score = 1;
    label = 'Weak';
  } else if (metCount === 4) {
    score = 2;
    label = 'Fair';
  } else if (metCount === 5) {
    score = 3;
    label = 'Strong';
  } else {
    score = 4;
    label = 'Very Strong';
  }

  return { score, label, requirements, isValid };
}

export function getPasswordErrorMessage(requirements: PasswordRequirement[]): string {
  const unmet = requirements.filter(r => !r.met);
  if (unmet.length === 0) return '';
  return `Password must have: ${unmet.map(r => r.label.toLowerCase()).join(', ')}`;
}
