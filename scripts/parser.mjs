// Markdown parser that produces structured paragraph data for the Google Docs API converter.
// Ported from the gravitas-md2gdocs Python library's regex-based approach.

const INLINE_PATTERN = new RegExp(
  '(' +
    '\\*\\*\\*(.+?)\\*\\*\\*' +       // ***bold italic***
    '|\\*\\*(.+?)\\*\\*' +             // **bold**
    '|\\*(.+?)\\*' +                   // *italic*
    '|~~(.+?)~~' +                     // ~~strikethrough~~
    '|`([^`]+)`' +                     // `code`
    '|\\[([^\\]]+)\\]\\(([^)]+)\\)' +  // [text](url)
  ')',
  'g'
);

function parseInline(text) {
  const runs = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index) });
    }

    const [, , boldItalic, bold, italic, strike, code, linkText, linkUrl] = match;

    if (boldItalic !== undefined) {
      runs.push({ text: boldItalic, bold: true, italic: true });
    } else if (bold !== undefined) {
      runs.push({ text: bold, bold: true });
    } else if (italic !== undefined) {
      runs.push({ text: italic, italic: true });
    } else if (strike !== undefined) {
      runs.push({ text: strike, strikethrough: true });
    } else if (code !== undefined) {
      runs.push({ text: code, code: true });
    } else if (linkText !== undefined) {
      runs.push({ text: linkText, link: linkUrl });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex) });
  }

  if (runs.length === 0) {
    runs.push({ text });
  }

  return runs;
}

function detectListItem(line) {
  const bulletMatch = line.match(/^(\s*)[*\-+]\s+(.*)/);
  if (bulletMatch) {
    const indent = bulletMatch[1].length;
    return { isListItem: true, listType: 'BULLET', nestingLevel: Math.floor(indent / 2), content: bulletMatch[2] };
  }

  const orderedMatch = line.match(/^(\s*)\d+[.)]\s+(.*)/);
  if (orderedMatch) {
    const indent = orderedMatch[1].length;
    return { isListItem: true, listType: 'NUMBER', nestingLevel: Math.floor(indent / 2), content: orderedMatch[2] };
  }

  return null;
}

export function parse(markdown) {
  const lines = markdown.split('\n');
  const paragraphs = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        paragraphs.push({
          runs: [{ text: codeBlockLines.join('\n') }],
          isCodeBlock: true,
        });
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      i++;
      continue;
    }

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      paragraphs.push({
        runs: parseInline(headingMatch[2]),
        headingLevel: headingMatch[1].length,
      });
      i++;
      continue;
    }

    // Blockquotes
    if (line.trimStart().startsWith('> ')) {
      const content = line.replace(/^\s*>\s?/, '');
      paragraphs.push({
        runs: parseInline(content),
        isBlockquote: true,
      });
      i++;
      continue;
    }

    // List items
    const listInfo = detectListItem(line);
    if (listInfo) {
      paragraphs.push({
        runs: parseInline(listInfo.content),
        isListItem: true,
        listType: listInfo.listType,
        nestingLevel: listInfo.nestingLevel,
      });
      i++;
      continue;
    }

    // Regular paragraph
    paragraphs.push({
      runs: parseInline(line),
    });
    i++;
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    paragraphs.push({
      runs: [{ text: codeBlockLines.join('\n') }],
      isCodeBlock: true,
    });
  }

  return paragraphs;
}
