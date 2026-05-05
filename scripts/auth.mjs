import { OAuth2Client } from 'google-auth-library';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import open from 'open';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_DIR = join(__dirname, 'credentials');
const CLIENT_SECRET_PATH = join(CREDENTIALS_DIR, 'client_secret.json');
const TOKEN_PATH = join(CREDENTIALS_DIR, 'token.json');

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
