import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { exec } from 'child_process';
import { google } from 'googleapis';

const CONFIG_PATH = path.join(__dirname, '../gmail-api.config.json');
const configJson = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const config = configJson.gmailApiConfig.paths;
const CONFIG_DIR = path.dirname(CONFIG_PATH);

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const LOOPBACK_HOST = '127.0.0.1';
const CALLBACK_PATH = '/oauth2callback';
const AUTH_TIMEOUT_MS = 3 * 60 * 1000;

async function manageToken() {
  const credentials = JSON.parse(fs.readFileSync(config.clientSecret, 'utf-8'));
  const { client_secret, client_id } = credentials.installed;

  try {
    const { code, redirectUri } = await getAuthorizationCodeAutomatically(client_id, client_secret);
    await saveToken(client_id, client_secret, redirectUri, code);
    return;
  } catch (error) {
    console.warn('Automatic browser capture did not complete. Falling back to manual code entry.');
    console.warn(String(error));
  }

  await manageTokenManually(client_id, client_secret, getManualRedirectUri());
}

async function getAuthorizationCodeAutomatically(clientId: string, clientSecret: string) {
  const server = http.createServer();
  const { port } = await listen(server);
  const redirectUri = `http://${LOOPBACK_HOST}:${port}${CALLBACK_PATH}`;
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });

  console.log('Opening Google authorization in your browser...');
  console.log(`If the browser does not open, visit this URL:\n${authUrl}\n`);
  openBrowser(authUrl);

  try {
    const code = await waitForAuthorizationCode(server);
    return { code, redirectUri };
  } finally {
    server.close();
  }
}

async function manageTokenManually(clientId: string, clientSecret: string, redirectUri: string) {
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });

  console.log('Authorize this app by visiting this URL:\n');
  console.log(authUrl);
  console.log('');

  const enteredValue = await prompt('Paste the full redirected URL or just the code here: ');
  const code = extractCode(enteredValue.trim());
  await saveToken(clientId, clientSecret, redirectUri, code);
}

async function saveToken(clientId: string, clientSecret: string, redirectUri: string, code: string) {
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const tokenResponse = await oAuth2Client.getToken(code.trim());
  const token = tokenResponse.tokens;

  fs.writeFileSync(config.token, JSON.stringify(token, null, 2));
  console.log(`Token saved to ${config.token}`);

  if (config.tokenCopy) {
    const tokenCopyPath = resolveConfigPath(config.tokenCopy);
    ensureParentDir(tokenCopyPath);

    if (pathExists(tokenCopyPath)) {
      fs.rmSync(tokenCopyPath, { force: true });
    }

    fs.copyFileSync(config.token, tokenCopyPath);
    console.log(`Token copied to ${tokenCopyPath}`);
  }
}

function waitForAuthorizationCode(server: http.Server): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for the Google callback.'));
    }, AUTH_TIMEOUT_MS);

    server.on('request', (req, res) => {
      if (!req.url) {
        return;
      }

      const requestUrl = new URL(req.url, `http://${LOOPBACK_HOST}`);
      if (requestUrl.pathname !== CALLBACK_PATH) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found.');
        return;
      }

      const error = requestUrl.searchParams.get('error');
      const code = requestUrl.searchParams.get('code');

      if (error) {
        clearTimeout(timeout);
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Authorization failed</h1><p>You can close this tab and return to the terminal.</p>');
        reject(new Error(`Google returned an authorization error: ${error}`));
        return;
      }

      if (!code) {
        clearTimeout(timeout);
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Authorization failed</h1><p>No authorization code was received.</p>');
        reject(new Error('No authorization code was received from Google.'));
        return;
      }

      clearTimeout(timeout);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Authorization complete</h1><p>You can close this tab and return to the terminal.</p>');
      resolve(code);
    });
  });
}

function listen(server: http.Server): Promise<{ port: number }> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK_HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not determine the local callback port.'));
        return;
      }

      resolve({ port: address.port });
    });
  });
}

function getManualRedirectUri(): string {
  return 'http://localhost';
}

function extractCode(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    const parsed = new URL(value);
    const code = parsed.searchParams.get('code');
    if (!code) {
      throw new Error('The pasted URL did not include a code query parameter.');
    }

    return code;
  }

  return value;
}

function openBrowser(url: string) {
  const platform = os.platform();
  if (platform === 'win32') {
    exec(`start "" "${url}"`);
    return;
  }

  if (platform === 'darwin') {
    exec(`open "${url}"`);
    return;
  }

  exec(`xdg-open "${url}"`);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

function resolveConfigPath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(CONFIG_DIR, filePath);
}

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pathExists(filePath: string): boolean {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch {
    return false;
  }
}

manageToken().catch(err => console.error('Error generating token:', err));
