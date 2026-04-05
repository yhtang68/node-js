import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import readline from 'readline';

const CONFIG_PATH = path.join(__dirname, '../gmail-api.config.json');
const configJson = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const config = configJson.gmailApiConfig.paths;

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function createAndCopyToken() {
  const credentials = JSON.parse(fs.readFileSync(config.clientSecret, 'utf-8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this URL:\n', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code from that page here: ', async (code) => {
    rl.close();
    const tokenResponse = await oAuth2Client.getToken(code.trim());
    const token = tokenResponse.tokens;

    // Save token
    fs.writeFileSync(config.token, JSON.stringify(token, null, 2));
    console.log(`Token saved to ${config.token}`);

    // Copy token to tokenCopy
    if (config.tokenCopy) {
      fs.copyFileSync(config.token, config.tokenCopy);
      console.log(`Token copied to ${config.tokenCopy}`);
    }
  });
}

createAndCopyToken().catch(err => console.error('Error generating token:', err));