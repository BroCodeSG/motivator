// Google Keep dark-mode note palette
export const PAGE_COLORS: Record<string, string> = {
  white: '#202124',
  red: '#5c2b29',
  orange: '#614a19',
  yellow: '#635d19',
  green: '#345920',
  teal: '#16504b',
  blue: '#2d555e',
  pink: '#5b2245',
  purple: '#42275e',
  grey: '#3c3f43',
};

export const DEFAULT_COLOR = 'yellow';

export function pageColor(key: string): string {
  return PAGE_COLORS[key] ?? PAGE_COLORS[DEFAULT_COLOR];
}

export const UI = {
  background: '#202124',
  surface: '#2d2e31',
  text: '#e8eaed',
  textMuted: '#9aa0a6',
  border: '#5f6368',
  accent: '#8ab4f8',
  onAccent: '#202124',
  danger: '#f28b82',
};
