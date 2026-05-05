# md-to-doc

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that converts markdown templates into formatted Google Docs with automatic variable substitution.

Templates use standard markdown with `{Variable}` placeholders. The skill parses the markdown, substitutes user-provided values, and creates a fully formatted Google Doc via the Docs API — headings, bold, italic, links, lists, code blocks, and blockquotes all render natively.

## Prerequisites

- **Node.js** >= 18
- **Google Cloud project** with the [Google Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com) and [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) enabled
- **Claude Code** (this is a Claude Code skill, invoked via `/md-to-doc`)

## Setup

### 1. Install dependencies

```bash
cd scripts
npm install
```

### 2. Configure Google OAuth credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Docs API** and **Google Drive API**
4. Navigate to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client ID**
6. Select application type: **Desktop app**
7. Download the JSON file
8. Save it as `scripts/credentials/client_secret.json`

> The `scripts/credentials/` directory is `.gitignore`d — credentials never enter version control.

### 3. Authenticate

```bash
cd scripts
npm run auth
```

This opens a browser window for Google OAuth consent. Grant access to Google Docs and Google Drive. Tokens are cached in `scripts/credentials/token.json` and auto-refresh on subsequent runs.

### 4. (Optional) Set a default Drive folder

Edit `config.yaml` and set `default_folder_id` to a Google Drive folder ID:

```yaml
default_folder_id: "1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
```

Documents will be created in that folder instead of your Drive root. Individual templates can override this via their frontmatter `folder_id` field.

## Usage

### As a Claude Code skill

Invoke within a Claude Code session:

```
/md-to-doc [template-name] [variable=value ...]
```

Examples:

```
/md-to-doc meeting-notes
/md-to-doc meeting-notes Date=2026-05-05 "Meeting Title=Weekly Sync"
```

Claude Code will:
1. Select the template from `templates/`
2. Identify variables and prompt for any not provided inline
3. Substitute values into the template
4. Create a formatted Google Doc and return the URL

### Direct CLI usage

You can also run the script directly (with pre-rendered markdown):

```bash
node scripts/create-doc.mjs \
  --title "My Document" \
  --input /path/to/rendered.md \
  --folder FOLDER_ID
```

The `--folder` argument is optional. The script outputs JSON:

```json
{"id": "abc123", "url": "https://docs.google.com/document/d/abc123/edit"}
```

## Templates

Templates live in `templates/` as markdown files with YAML frontmatter.

### Example: `meeting-notes.md`

```markdown
---
title: "{Date} | {Meeting Title}"
folder_id: ""
---
## {Date} | {Meeting Title}
Attendees: {[ Attendee List ]}

Previous call notes: {Previous Call Notes}

Notes:
*

Action Items:
*
```

### Variable types

- **Single-value**: `{Variable Name}` — replaced with a single string
- **List-value**: `{[ Variable Name ]}` — accepts comma-separated input (e.g. "Alice, Bob, Charlie")

### Behavior

- `{Date}` defaults to today's date (`YYYY-MM-DD`) if not provided
- If a variable is left empty, the **entire line** containing it is removed from the output
- The same variable can appear multiple times — all occurrences are replaced

See [`references/template-syntax.md`](references/template-syntax.md) for the full authoring reference.

## How it works

1. **`SKILL.md`** defines the skill for Claude Code — it describes the workflow Claude follows (template selection, variable extraction, substitution, script invocation)
2. **`scripts/create-doc.mjs`** is the main entry point: authenticates via OAuth, parses rendered markdown, converts to Google Docs API requests, and creates the document
3. **`scripts/parser.mjs`** handles markdown parsing — headings, lists, inline formatting, code blocks, blockquotes
4. **`scripts/converter.mjs`** translates parsed paragraphs into Google Docs API `batchUpdate` insert and style requests

## Project structure

```
md-to-doc/
├── SKILL.md                     # Skill definition (read by Claude Code)
├── config.yaml                  # Default Drive folder ID
├── LICENSE
├── README.md
├── references/
│   └── template-syntax.md       # Template authoring reference
├── templates/
│   └── meeting-notes.md         # Example template
└── scripts/
    ├── package.json
    ├── create-doc.mjs           # Main entry point
    ├── auth.mjs                 # OAuth2 browser-based auth
    ├── parser.mjs               # Markdown parser
    ├── converter.mjs            # Markdown → Google Docs API requests
    ├── init-auth.mjs            # Standalone auth initialization
    └── credentials/             # .gitignored
        ├── client_secret.json   # OAuth app credentials (you provide)
        └── token.json           # Cached tokens (auto-generated)
```

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.
