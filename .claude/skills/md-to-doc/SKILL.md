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
  - mcp__claude_ai_Google_Drive__create_file
  - mcp__claude_ai_Google_Drive__search_files
argument-hint: "[template-name] [variable=value ...]"
---

# Markdown-to-Google-Doc Skill

You convert markdown templates into formatted Google Docs. The project root is `${CLAUDE_SKILL_DIR}/../../..` (three levels up from this SKILL.md).

## Workflow

### 1. Ensure the Python virtualenv exists

Check if `<project-root>/scripts/.venv/bin/python` exists. If not, create it:

```bash
cd <project-root>/scripts && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
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

### 7. Convert markdown to HTML

Write the rendered markdown body (without frontmatter) to a temporary file, then convert:

```bash
<project-root>/scripts/.venv/bin/python <project-root>/scripts/md_to_html.py < /tmp/md_to_doc_rendered.md
```

Capture the HTML output.

### 8. Determine target folder

Read `<project-root>/config.yaml`. Use the template's `folder_id` if set and non-empty; otherwise use `default_folder_id` from config.yaml. If both are empty, omit the parentId (doc goes to Drive root).

### 9. Create the Google Doc

Call `mcp__claude_ai_Google_Drive__create_file` with:

- `title`: the rendered title from frontmatter
- `textContent`: the HTML output from step 7
- `contentMimeType`: `"text/html"`
- `parentId`: the folder ID from step 8 (omit if empty)

### 10. Report the result

Tell the user the document was created and provide the Google Doc URL from the response.

## Troubleshooting

If the Google Doc is created as an HTML file rather than a native Google Doc, the `text/html` mime type may not auto-convert. In that case:

1. Try creating with `contentMimeType: "text/html"` and `disableConversionToGoogleType: false` (explicitly)
2. If that still doesn't work, fall back to plain text: strip HTML tags and use `contentMimeType: "text/plain"`
3. Report to the user what happened so they can adjust

## Reference

For template authoring syntax, see `<project-root>/references/template-syntax.md`.
