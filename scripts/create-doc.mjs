#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { google } from 'googleapis';
import { getAuthClient } from './auth.mjs';
import { parse } from './parser.mjs';
import { toRequests } from './converter.mjs';

function parseArgs(argv) {
  const args = { title: 'Untitled', folder: '', input: '', shareDomain: '', shareRole: '' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--title' && argv[i + 1]) {
      args.title = argv[++i];
    } else if (argv[i] === '--folder' && argv[i + 1]) {
      args.folder = argv[++i];
    } else if (argv[i] === '--input' && argv[i + 1]) {
      args.input = argv[++i];
    } else if (argv[i] === '--share-domain' && argv[i + 1]) {
      args.shareDomain = argv[++i];
    } else if (argv[i] === '--share-role' && argv[i + 1]) {
      args.shareRole = argv[++i];
    }
  }
  return args;
}

async function readMarkdown(inputPath) {
  if (inputPath) {
    return readFileSync(inputPath, 'utf-8');
  }
  // Read from stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
  const args = parseArgs(process.argv);

  const auth = await getAuthClient();

  const markdown = await readMarkdown(args.input);

  if (!markdown.trim()) {
    console.error('No markdown content provided.');
    process.exit(1);
  }
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  // Create empty document
  const createRes = await docs.documents.create({
    requestBody: { title: args.title },
  });
  const docId = createRes.data.documentId;

  // Move to folder if specified
  if (args.folder) {
    const fileRes = await drive.files.get({ fileId: docId, fields: 'parents' });
    const previousParents = (fileRes.data.parents || []).join(',');
    await drive.files.update({
      fileId: docId,
      addParents: args.folder,
      removeParents: previousParents,
      fields: 'id, parents',
    });
  }

  // Parse markdown and build requests
  const paragraphs = parse(markdown);
  const { insertRequests, styleRequests } = toRequests(paragraphs);
  const allRequests = [...insertRequests, ...styleRequests];

  if (allRequests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: allRequests },
    });
  }

  // Apply org-wide sharing if configured
  if (args.shareDomain) {
    const roleMap = { commenter: 'commenter', reader: 'reader', writer: 'writer' };
    const role = roleMap[args.shareRole] || 'commenter';
    await drive.permissions.create({
      fileId: docId,
      requestBody: {
        type: 'domain',
        domain: args.shareDomain,
        role,
      },
    });
  }

  const url = `https://docs.google.com/document/d/${docId}/edit`;
  console.log(JSON.stringify({ id: docId, url }));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
