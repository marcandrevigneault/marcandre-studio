export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value) || /%(?:5c|0a|0d)/i.test(value)) return '/admin';
  try { return new URL(value, 'https://studio.invalid').origin === 'https://studio.invalid' ? value : '/admin'; }
  catch { return '/admin'; }
}

