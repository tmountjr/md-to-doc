# Template Syntax Reference

## File Format

Templates are markdown files with YAML frontmatter:

```markdown
---
title: "Document Title with {Variables}"
folder_id: ""
---
Your markdown content here with {Variable} placeholders.
```

## Frontmatter Fields

| Field | Required | Description |
|---|---|---|
| `title` | Yes | Google Doc title. Supports variable substitution. |
| `folder_id` | No | Google Drive folder ID. Overrides the global default from `config.yaml`. Leave empty to use the global default. |

## Variable Syntax

### Single-value variables

Use `{Variable Name}` for a placeholder that gets replaced with a single value.

```markdown
## {Date} | {Meeting Title}
```

### List variables

Use `{[ Variable Name ]}` for a placeholder that accepts a comma-separated list of values.

```markdown
Attendees: {[ Attendee List ]}
```

When invoked, the user provides values like: `Alice, Bob, Charlie`

### Variable naming

- Use descriptive, title-cased names with spaces: `{Meeting Title}`, `{Date}`, `{[ Attendee List ]}`
- Variable names are case-sensitive
- The same variable can appear multiple times in a template — all occurrences are replaced

## Supported Markdown

All standard markdown features are supported and will render in Google Docs:

- **Headers**: `#`, `##`, `###`, etc.
- **Bold**: `**text**`
- **Italic**: `*text*`
- **Links**: `[text](url)`
- **Unordered lists**: `* item` or `- item`
- **Ordered lists**: `1. item`
- **Tables**: standard markdown table syntax
- **Code blocks**: fenced with triple backticks

## Adding New Templates

1. Create a new `.md` file in the `templates/` directory
2. Add YAML frontmatter with at least a `title` field
3. Write the document body using markdown with `{Variable}` placeholders
4. The skill will automatically detect and prompt for all variables
