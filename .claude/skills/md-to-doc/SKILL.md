---
name: md-to-doc
description: >
  Create a Google Doc from a markdown template. Use when the user asks to
  "create a doc from template", "generate meeting notes", "fill in a template
  and push to Google Docs", or similar. Handles variable substitution and
  uploads formatted documents to Google Drive.
allowed-tools:
  - Bash
  - Read
  - Write
argument-hint: "[template-name] [variable=value ...]"
---

# Markdown-to-Google-Doc Skill

You convert markdown templates into formatted Google Docs. The project root is `${CLAUDE_SKILL_DIR}/../../..` (three levels up from this SKILL.md).

## Workflow

### 1. Ensure Node.js dependencies are installed

Check if `<project-root>/scripts/node_modules` exists. If not, run:

```bash
cd <project-root>/scripts && npm install
```

### 2. Select a template

List `.md` files in `<project-root>/templates/`. If the user specified a template name in the arguments (e.g., `/md-to-doc meeting-notes`), match it. If only one template exists, use it. If multiple exist and none was specified, ask the user to choose.

### 3. Parse the template

Read the selected template file. It has two parts separated by the second `---`:

- **Frontmatter** (YAML between the `---` delimiters): contains `title` and optionally `folder_id`
- **Body** (everything after the second `---`): the markdown content

### 4. Identify variables

Scan both the frontmatter `title` and the body for placeholders:

- **Single-value**: `{Variable Name}` — matches the regex `\{([^[\]{}]+)\}`
- **List-value**: `{[ Variable Name ]}` — matches the regex `\{\[\s*([^\]]+?)\s*\]\}`

Collect all unique variable names.

### 5. Collect variable values

For each variable, either use a value from the arguments (if passed as `variable=value`) or prompt the user. Apply these smart defaults:

- `{Date}`: default to today's date formatted as `YYYY-MM-DD`
- For list variables, accept comma-separated input

If the user provided inline arguments like `/md-to-doc meeting-notes Date=2026-05-05 "Meeting Title=Weekly Sync"`, parse those and only prompt for remaining unfilled variables.

### 6. Substitute variables

Replace all `{Variable Name}` and `{[ Variable Name ]}` occurrences in both the title and body with the collected values. For list variables, replace the entire `{[ ... ]}` token with the comma-separated values as-is.

If a variable's value is empty or not provided, remove the **entire line** containing that variable from the rendered output (not just the placeholder — the full line including any label text). This avoids leaving orphaned labels like "Previous call notes:" with nothing after them.

### 7. Create the Google Doc

Write the rendered markdown body (without frontmatter) to a temporary file, then run the Node.js script:

```bash
node <project-root>/scripts/create-doc.mjs \
  --title "<rendered title>" \
  --folder "<folder_id>" \
  --input /tmp/md_to_doc_rendered.md
```

The `--folder` argument is optional. Determine the target folder: use `folder_id` from template frontmatter if set and non-empty; otherwise read `default_folder_id` from `<project-root>/config.yaml`. If both are empty, omit the `--folder` argument (doc goes to Drive root).

The script outputs JSON to stdout: `{"id": "...", "url": "https://docs.google.com/document/d/.../edit"}`

### 8. Report the result

Parse the JSON output and tell the user the document was created. Provide the Google Doc URL.

## First-run auth

On first use, the script will open a browser for Google OAuth consent. The user must authorize the app. Tokens are saved to `<project-root>/scripts/credentials/token.json` and auto-refresh on subsequent runs.

If `scripts/credentials/client_secret.json` is missing, tell the user they need to:
1. Go to Google Cloud Console
2. Create OAuth2 credentials (Desktop app type)
3. Download the JSON and save it as `scripts/credentials/client_secret.json`

## Reference

For template authoring syntax, see `<project-root>/references/template-syntax.md`.
