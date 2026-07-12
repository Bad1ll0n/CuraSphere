const INJECTION_PATTERNS: RegExp[] = [
  /\[\s*INST\s*\]/gi,
  /###\s*(SYSTEM|Human|Assistant)/gi,
  /<\|.*?\|>/gs,
  /IGNORE\s+(?:ALL\s+)?PREVIOUS\s+INSTRUCTIONS?/gi,
  /\bSYSTEM\s*:/gi,
  /\bDAN\s*:/gi,
  /\bJailbreak\b/gi,
  /\bPrompt\s+Injection\b/gi,
  /\bAct\s+as\s+(?:DAN|GPT|an?\s+AI\s+without)/gi,
];

export function sanitizeForPrompt(input: unknown, maxLength = 500): string {
  if (!input || typeof input !== 'string') return '';
  let s = input.trim().slice(0, maxLength);
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, '[REDACTED]');
  }
  return s;
}
