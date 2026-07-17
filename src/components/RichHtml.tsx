import { Linking, StyleSheet, Text, View } from 'react-native';

import { UI } from '@/theme';

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  highlight: boolean;
  strike: boolean;
  href?: string;
}
interface Line {
  runs: Run[];
  heading: boolean;
  bullet: boolean;
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');
}

// Minimal HTML -> lines/runs parser for the tags the editor emits.
function parse(html: string): Line[] {
  const lines: Line[] = [];
  let cur: Run[] = [];
  const st = { bold: false, italic: false, underline: false, highlight: false, strike: false, href: undefined as string | undefined };
  let heading = false;
  let bullet = false;
  const pushLine = () => {
    lines.push({ runs: cur, heading, bullet });
    cur = [];
    heading = false;
    bullet = false;
  };

  for (const tok of html.split(/(<[^>]+>)/)) {
    if (!tok) continue;
    if (tok[0] === '<') {
      const closing = tok[1] === '/';
      const name = tok.replace(/[</>]/g, '').split(/\s/)[0].toLowerCase();
      if (name === 'strong' || name === 'b') st.bold = !closing;
      else if (name === 'em' || name === 'i') st.italic = !closing;
      else if (name === 'u') st.underline = !closing;
      else if (name === 'mark') st.highlight = !closing;
      else if (name === 'del' || name === 's' || name === 'strike') st.strike = !closing;
      else if (name === 'a') {
        if (closing) st.href = undefined;
        else st.href = (tok.match(/href="([^"]*)"/) || [])[1];
      } else if (name === 'h1' || name === 'h2') {
        if (!closing) heading = true;
        else pushLine();
      } else if (name === 'li') {
        if (!closing) bullet = true;
        else pushLine();
      } else if (name === 'br') {
        pushLine();
      } else if ((name === 'div' || name === 'p') && closing) {
        pushLine();
      }
    } else {
      const text = decode(tok);
      if (text) cur.push({ text, bold: st.bold, italic: st.italic, underline: st.underline, highlight: st.highlight, strike: st.strike, href: st.href });
    }
  }
  if (cur.length) pushLine();
  return lines.filter((l) => l.runs.length || l.bullet);
}

export function RichHtml({ value, style }: { value: string; style?: any }) {
  if (!value) return null;
  const lines = parse(value);
  if (!lines.length) return null;
  return (
    <View>
      {lines.map((line, li) => (
        <Text key={li} style={[line.heading ? styles.h1 : styles.body, style]}>
          {line.bullet ? '•  ' : ''}
          {line.runs.map((r, i) => (
            <Text
              key={i}
              onPress={r.href ? () => Linking.openURL(r.href!).catch(() => {}) : undefined}
              style={{
                fontWeight: r.bold || line.heading ? '700' : '400',
                fontStyle: r.italic ? 'italic' : 'normal',
                textDecorationLine: r.strike ? 'line-through' : r.underline || r.href ? 'underline' : 'none',
                ...(r.href ? { color: UI.accent } : {}),
                ...(r.highlight ? { backgroundColor: '#fff475', color: '#202124' } : {}),
              }}
            >
              {r.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, color: UI.text, lineHeight: 22 },
  h1: { fontSize: 22, fontWeight: '700', color: UI.text, lineHeight: 30 },
});
