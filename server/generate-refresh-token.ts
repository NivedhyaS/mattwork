import http from 'http';
import url from 'url';
import { google } from 'googleapis';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function findCredentialsFile(): string | null {
  const downloadsPath = path.join(os.homedir(), 'Downloads');
  if (!fs.existsSync(downloadsPath)) return null;
  const files = fs.readdirSync(downloadsPath);
  // Look for client_secret_*.json or credentials*.json
  const match = files.find(f => f.startsWith('client_secret_') && f.endsWith('.json'));
  if (match) return path.join(downloadsPath, match);
  const credentialsMatch = files.find(f => f.startsWith('credentials') && f.endsWith('.json'));
  if (credentialsMatch) return path.join(downloadsPath, credentialsMatch);
  return null;
}

async function main() {
  console.log('=== Google OAuth2 Refresh Token Generator ===\n');

  // 1. Locate credentials
  const credentialsPath = findCredentialsFile();
  if (!credentialsPath) {
    console.error('❌ Could not find Google OAuth credentials JSON file in Downloads folder.');
    console.error('Please make sure you downloaded the client secret JSON file from Google Cloud Console.');
    process.exit(1);
  }
  console.log(`Found credentials file: ${credentialsPath}`);
  const credentialsRaw = fs.readFileSync(credentialsPath, 'utf8');
  const credentials = JSON.parse(credentialsRaw);

  const clientInfo = credentials.installed || credentials.web;
  if (!clientInfo) {
    console.error('❌ JSON credentials file format is invalid.');
    process.exit(1);
  }

  const { client_id, client_secret } = clientInfo;

  // 2. Set up OAuth2 Client
  // Use http://localhost:8085 as the redirect URI (Google loopback allows any port for Desktop apps)
  const PORT = 8085;
  const redirectUri = `http://localhost:${PORT}`;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/forms.body.readonly',
    'https://www.googleapis.com/auth/forms.responses.readonly',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to obtain a refresh token
    prompt: 'consent',     // Forces consent screen to ensure a refresh token is returned
    scope: scopes,
  });

  // 3. Start temporary local HTTP server to capture the callback code
  const server = http.createServer(async (req, res) => {
    const reqUrl = url.parse(req.url || '', true);
    
    if (reqUrl.pathname === '/') {
      const code = reqUrl.query.code as string;
      const error = reqUrl.query.error as string;

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication Successful!</h1><p>You can close this window now and return to your terminal.</p>');
        
        console.log('\nReceived callback request. Exchanging authorization code for tokens...');
        
        try {
          const { tokens } = await oauth2Client.getToken(code);
          console.log('\n=== COPY THE FOLLOWING VALUES TO YOUR .env ===\n');
          console.log(`GOOGLE_CLIENT_ID=${client_id}`);
          console.log(`GOOGLE_CLIENT_SECRET=${client_secret}`);
          console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
          console.log('\n=============================================');
        } catch (err: any) {
          console.error('❌ Error exchanging code:', err.message || err);
        } finally {
          server.close(() => {
            console.log('\nTemporary callback server closed.');
            process.exit(0);
          });
        }
      } else if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authentication Failed</h1><p>Google returned error: <strong>${error}</strong></p>`);
        console.error(`\n❌ Authentication failed. Google returned error: ${error}`);
        if (error === 'access_denied') {
          console.error('\n💡 Troubleshooting "access_denied":');
          console.error('1. You may have cancelled the authorization request.');
          console.error('2. Since the Google Cloud OAuth app is in "Testing" mode, only accounts added under the "Test Users" section are allowed to authenticate.');
          console.error('   -> Go to Google Cloud Console (APIs & Services > OAuth consent screen)');
          console.error('   -> Scroll down to "Test users"');
          console.error('   -> Add the Google account you are attempting to authenticate with.');
        }
        server.close(() => {
          console.log('\nTemporary callback server closed.');
          process.exit(1);
        });
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('No authorization code found in request query.');
      }
    }
  });

  server.listen(PORT, () => {
    console.log(`\nTemporary local server listening on: ${redirectUri}`);
    console.log('\n-----------------------------------------------------');
    console.log('Google Authorization URL:');
    console.log(authUrl);
    console.log('-----------------------------------------------------\n');
    console.log('Opening browser for authorization...');
    
    // 4. Open Google OAuth URL automatically in browser using spawn (bypasses shell parser issues)
    const openCmd = os.platform() === 'win32' ? 'powershell.exe' : 'open';
    const args = os.platform() === 'win32' 
      ? ['-NoProfile', '-Command', `Start-Process '${authUrl}'`] 
      : [authUrl];
      
    const proc = spawn(openCmd, args, { detached: true, stdio: 'ignore' });
    proc.unref();
    
    proc.on('error', () => {
      console.log('\n⚠️ Failed to open browser automatically. Please open the link above manually.');
    });
  });
}

main().catch(console.error);
