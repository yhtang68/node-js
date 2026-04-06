# LinkedIn Job Review

This project reads LinkedIn job alert emails from Gmail and generates a foldable HTML review page.

## 1. Project Setup

### Install dependencies

```bash
npm install
```

### Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project, for example `gmail-email-fetcher`.
3. Enable the **Gmail API** for that project.

### Configure the OAuth consent screen

1. Open **APIs & Services -> OAuth consent screen**.
2. Choose **External** for testing.
3. Fill in the basic app information.
4. Keep the app in **Testing** status.
5. Add your Gmail account under **Test Users**.

Only test users can authorize the app while it is in testing mode.

### Create OAuth credentials

1. Open **APIs & Services -> Credentials**.
2. Create an **OAuth 2.0 Client ID**.
3. Choose **Desktop app**.
4. Download the client credentials JSON file.
5. Put that file somewhere safe on your machine.

### Configure `gmail-api.config.json`

This project reads Gmail credential paths from [`gmail-api.config.json`](/c:/dev/yhtang/node-js/gmail/gmail-api.config.json).

Example:

```json
{
  "gmailApiConfig": {
    "paths": {
      "clientSecret": "C:\\Users\\ANDY TANG\\OneDrive\\Documents\\ANDY\\GMAIL\\madeinuk14_gmail_client_secret_cred.json",
      "token": "C:\\Users\\ANDY TANG\\OneDrive\\Documents\\ANDY\\GMAIL\\gmail_token.json",
      "tokenCopy": "./gmail-token.sym-link.json"
    }
  }
}
```

Fields:

* `clientSecret`: Absolute path to the Google OAuth client credentials JSON.
* `token`: Absolute path to the Gmail OAuth token file created later by `npm run manageToken`.
* `tokenCopy`: Local project-side token reference file.

How it is used:

* [`auth.ts`](/c:/dev/yhtang/node-js/gmail/src/auth.ts) loads this file.
* `paths.clientSecret` is used to create the Google OAuth client.
* `paths.token` is used to load the saved Gmail token.
* If the token file is missing, the app asks you to generate it first.

Notes:

* `clientSecret` and `token` can live outside the repo.
* Update the paths on each machine if your local credential locations are different.
* `gmail-token.sym-link.json` is only a project helper file and does not replace the real token path in `paths.token`.

## 2. Manage Token

Run:

```bash
npm run manageToken
```

Then:

1. Copy the authorization URL printed in the terminal into your browser.
2. Sign in with your Gmail test user.
3. Approve the requested Gmail permissions.
4. After Google redirects to `http://localhost/?code=...`, copy the `code` value.
5. Paste that code back into the terminal.

What happens next:

* The token is saved to the path configured in `gmail-api.config.json`.
* A local helper copy is written to `gmail-token.sym-link.json`.

You usually only need to do this again if the token expires, is revoked, or you switch accounts.

## 3. Create Review

Run:

```bash
npm run reviewJobs
```

This script runs:

```json
"reviewJobs": "ts-node src/index.ts"
```

What it does:

* Starts the review flow from [`index.ts`](/c:/dev/yhtang/node-js/gmail/src/index.ts).
* Connects to Gmail using the configured OAuth files.
* Fetches emails from `jobalerts-noreply@linkedin.com`.
* Parses job entries from those emails.
* Generates the review page at [`Review-Linked-In-Jobs.html`](/c:/dev/yhtang/node-js/gmail/Results/Review-Linked-In-Jobs.html).

Open the generated HTML file in [`Results`](/c:/dev/yhtang/node-js/gmail/Results) to review the grouped and foldable job results.

## Notes

* The `punycode` deprecation warning in the terminal can be ignored for now.
* If Google returns a 403 during authorization, make sure your Gmail account was added as a test user.
