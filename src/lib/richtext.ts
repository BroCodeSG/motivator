// Notes are stored as HTML (produced by the WYSIWYG editor). These helpers
// migrate the older markdown notes to HTML on read, and flatten HTML to plain
// text for notifications, previews, and email fallbacks.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMdToHtml(s: string): string {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

export function mdToHtml(md: string): string {
  let html = '';
  let inList = false;
  for (const line of md.split('\n')) {
    if (/^- /.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inlineMdToHtml(line.slice(2))}</li>`;
      continue;
    }
    if (inList) {
      html += '</ul>';
      inList = false;
    }
    if (/^# /.test(line)) html += `<h1>${inlineMdToHtml(line.slice(2))}</h1>`;
    else if (line === '') html += '<div><br></div>';
    else html += `<div>${inlineMdToHtml(line)}</div>`;
  }
  if (inList) html += '</ul>';
  return html;
}

// A stored value with no '<' is legacy markdown (or empty) -> convert to HTML.
export function ensureHtml(value: string): string {
  if (!value) return '';
  return value.indexOf('<') === -1 ? mdToHtml(value) : value;
}

export function htmlToPlain(html: string): string {
  return (html || '')
    .replace(/<li>/gi, '• ')
    .replace(/<\/(div|p|h1|h2|li|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
