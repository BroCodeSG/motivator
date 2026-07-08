// Google Keep note palette
export const PAGE_COLORS: Record<string, string> = {
  white: '#ffffff',
  red: '#f28b82',
  orange: '#fbbc04',
  yellow: '#fff475',
  green: '#ccff90',
  teal: '#a7ffeb',
  blue: '#aecbfa',
  pink: '#fdcfe8',
  purple: '#d7aefb',
  grey: '#e8eaed',
};

export const DEFAULT_COLOR = 'yellow';

export function pageColor(key: string): string {
  return PAGE_COLORS[key] ?? PAGE_COLORS[DEFAULT_COLOR];
}

export const UI = {
  background: '#ffffff',
  text: '#202124',
  textMuted: '#5f6368',
  border: '#dadce0',
  accent: '#1a73e8',
  danger: '#d93025',
};
