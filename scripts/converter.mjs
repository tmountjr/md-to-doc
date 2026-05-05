// Converts parsed markdown paragraphs to Google Docs API batchUpdate requests.
// Uses the reverse-insertion trick from gravitas-md2gdocs for correct index management.

const HEADING_STYLES = {
  1: 'HEADING_1',
  2: 'HEADING_2',
  3: 'HEADING_3',
  4: 'HEADING_4',
  5: 'HEADING_5',
  6: 'HEADING_6',
};

function buildTextStyleRequest(startIndex, endIndex, run) {
  const textStyle = {};
  const fields = [];

  if (run.bold) {
    textStyle.bold = true;
    fields.push('bold');
  }
  if (run.italic) {
    textStyle.italic = true;
    fields.push('italic');
  }
  if (run.strikethrough) {
    textStyle.strikethrough = true;
    fields.push('strikethrough');
  }
  if (run.code) {
    textStyle.weightedFontFamily = { fontFamily: 'Courier New', weight: 400 };
    textStyle.backgroundColor = {
      color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } },
    };
    fields.push('weightedFontFamily', 'backgroundColor');
  }
  if (run.link) {
    textStyle.link = { url: run.link };
    fields.push('link');
  }

  if (fields.length === 0) return null;

  return {
    updateTextStyle: {
      range: { startIndex, endIndex },
      textStyle,
      fields: fields.join(','),
    },
  };
}

export function toRequests(paragraphs, startIndex = 1) {
  const insertRequests = [];
  const styleRequests = [];
  let currentIndex = startIndex;

  for (const para of paragraphs) {
    const textContent = para.runs.map((r) => r.text).join('') + '\n';
    const paraStart = currentIndex;

    // All inserts target startIndex (will be reversed later)
    insertRequests.push({
      insertText: {
        location: { index: startIndex },
        text: textContent,
      },
    });

    // Heading style
    if (para.headingLevel && HEADING_STYLES[para.headingLevel]) {
      styleRequests.push({
        updateParagraphStyle: {
          range: { startIndex: paraStart, endIndex: paraStart + textContent.length },
          paragraphStyle: { namedStyleType: HEADING_STYLES[para.headingLevel] },
          fields: 'namedStyleType',
        },
      });
    }

    // Blockquote style
    if (para.isBlockquote) {
      styleRequests.push({
        updateParagraphStyle: {
          range: { startIndex: paraStart, endIndex: paraStart + textContent.length },
          paragraphStyle: {
            indentStart: { magnitude: 36, unit: 'PT' },
            indentFirstLine: { magnitude: 36, unit: 'PT' },
            borderLeft: {
              color: { color: { rgbColor: { red: 0.75, green: 0.75, blue: 0.75 } } },
              width: { magnitude: 3, unit: 'PT' },
              padding: { magnitude: 8, unit: 'PT' },
              dashStyle: 'SOLID',
            },
          },
          fields: 'indentStart,indentFirstLine,borderLeft',
        },
      });
    }

    // Code block style
    if (para.isCodeBlock) {
      styleRequests.push({
        updateTextStyle: {
          range: { startIndex: paraStart, endIndex: paraStart + textContent.length - 1 },
          textStyle: {
            weightedFontFamily: { fontFamily: 'Courier New', weight: 400 },
            backgroundColor: {
              color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } },
            },
          },
          fields: 'weightedFontFamily,backgroundColor',
        },
      });
    }

    // Bullet/numbered list
    if (para.isListItem) {
      const bulletPreset =
        para.listType === 'NUMBER'
          ? 'NUMBERED_DECIMAL_NESTED'
          : 'BULLET_DISC_CIRCLE_SQUARE';
      styleRequests.push({
        createParagraphBullets: {
          range: { startIndex: paraStart, endIndex: paraStart + textContent.length },
          bulletPreset,
        },
      });
    }

    // Inline formatting for each run
    let runOffset = paraStart;
    for (const run of para.runs) {
      const runEnd = runOffset + run.text.length;
      const styleReq = buildTextStyleRequest(runOffset, runEnd, run);
      if (styleReq) {
        styleRequests.push(styleReq);
      }
      runOffset = runEnd;
    }

    currentIndex += textContent.length;
  }

  // Reverse inserts so text appears in correct order
  insertRequests.reverse();

  return { insertRequests, styleRequests };
}
