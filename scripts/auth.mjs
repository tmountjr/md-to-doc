import { OAuth2Client } from 'google-auth-library';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, accessSync, constants, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import open from 'open';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_DIR = join(__dirname, 'credentials');
const CLIENT_SECRET_PATH = join(CREDENTIALS_DIR, 'client_secret.json');
const BUILTIN_TOKEN_PATH = join(CREDENTIALS_DIR, 'token.json');

// Resolve a writable token path. If the built-in credentials dir is writable,
// use it directly. Otherwise, mirror to a writable fallback directory so that
// token refreshes don't crash on read-only skill mounts.
function resolveTokenPath() {
  try {
    accessSync(CREDENTIALS_DIR, constants.W_OK);
    return BUILTIN_TOKEN_PATH;
  } catch {
    // Credentials dir is read-only — use a writable fallback.
    const fallbackDir = join(homedir() || tmpdir(), '.md-to-doc', 'credentials');
    mkdirSync(fallbackDir, { recursive: true });
    const fallbackToken = join(fallbackDir, 'token.json');

    // Seed the fallback from the built-in token if we haven't already.
    if (!existsSync(fallbackToken) && existsSync(BUILTIN_TOKEN_PATH)) {
      copyFileSync(BUILTIN_TOKEN_PATH, fallbackToken);
    }
    return fallbackToken;
  }
}

const TOKEN_PATH = resolveTokenPath();

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
];

function loadClientCredentials() {
  if (!existsSync(CLIENT_SECRET_PATH)) {
    throw new Error(
      `Missing ${CLIENT_SECRET_PATH}\n` +
      'Download OAuth2 credentials from Google Cloud Console and save them there.'
    );
  }
  const raw = JSON.parse(readFileSync(CLIENT_SECRET_PATH, 'utf-8'));
  const creds = raw.installed || raw.web;
  if (!creds) {
    throw new Error('Invalid client_secret.json — expected "installed" or "web" key');
  }
  return creds;
}

function createOAuth2Client(creds) {
  return new OAuth2Client(
    creds.client_id,
    creds.client_secret,
    'http://localhost:3000/oauth2callback'
  );
}

function saveToken(tokens) {
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

async function authenticateViaBrowser(oauth2Client) {
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url.startsWith('/oauth2callback')) return;
      const url = new URL(req.url, 'http://localhost:3000');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.end('Authorization denied.');
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        saveToken(tokens);
        res.end('Authorization successful! You can close this tab.');
        server.close();
        resolve(oauth2Client);
      } catch (err) {
        res.end('Failed to exchange authorization code.');
        server.close();
        reject(err);
      }
    });

    server.listen(3000, () => {
      console.error('Opening browser for Google authorization...');
      open(authorizeUrl);
    });
  });
}

export async function getAuthClient() {
  const creds = loadClientCredentials();
  const oauth2Client = createOAuth2Client(creds);

  if (existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2Client.setCredentials(tokens);

    oauth2Client.on('tokens', (newTokens) => {
      const merged = { ...tokens, ...newTokens };
      saveToken(merged);
    });

    return oauth2Client;
  }

  return authenticateViaBrowser(oauth2Client);
}
