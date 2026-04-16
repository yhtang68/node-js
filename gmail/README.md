# Job Review (LinkedIn + Glassdoor)

This project reads job alert emails from Gmail (LinkedIn + Glassdoor) and generates review files in both HTML and JSON format, including a filtered version with duplicate jobs removed (and optional salary filtering for Glassdoor).

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
      "tokenCopy": "./gmail-token.copy.json"
    }
  }
}
```

Fields:

* `clientSecret`: Absolute path to the Google OAuth client credentials JSON.
* `token`: Absolute path to the Gmail OAuth token file created later by `npm run manageToken`.
* `tokenCopy`: Local project-side copied token file.

How it is used:

* [`auth.ts`](/c:/dev/yhtang/node-js/gmail/src/auth.ts) loads this file.
* `paths.clientSecret` is used to create the Google OAuth client.
* `paths.token` is used to load the saved Gmail token.
* If the token file is missing, the app asks you to generate it first.

Notes:

* `clientSecret` and `token` can live outside the repo.
* Update the paths on each machine if your local credential locations are different.
* `gmail-token.copy.json` is only a project helper copy and does not replace the real token path in `paths.token`.
* `gmail-token.copy.json` is git-ignored, so the copied local token file will not be committed.

## 2. Manage Token

Run:

```bash
npm run manageToken
```

The script now tries to make the flow easier:

1. It starts a temporary local callback server.
2. It opens the Google authorization page in your browser automatically.
3. After you approve access, Google redirects back to the local callback.
4. The script captures the authorization code automatically and saves the token.

If the browser does not open or the automatic callback flow times out, the script falls back to manual mode and lets you paste either:

* the full redirected URL, or
* just the `code` value

Manual fallback steps:

1. Copy the authorization URL printed in the terminal into your browser.
2. Sign in with your Gmail test user.
3. Approve the requested Gmail permissions.
4. Copy the full redirected URL or the `code` value.
5. Paste it back into the terminal.

What happens next:

* The token is saved to the path configured in `gmail-api.config.json`.
* A local helper copy is written to `gmail-token.copy.json`.

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
* Fetches emails from:
  * `jobalerts-noreply@linkedin.com` (LinkedIn)
  * `noreply@glassdoor.com` (Glassdoor)
* Parses job entries from those emails.
* Generates the full review files (per source), for example:
  * `Results/Linked-In-Jobs-Review.html` + `Results/Linked-In-Jobs-Review.json`
  * `Results/Glassdoor-Jobs-Review.html` + `Results/Glassdoor-Jobs-Review.json`
* Generates the filtered review files (per source), for example:
  * `Results/Linked-In-Jobs-Review-Filtered.html` + `Results/Linked-In-Jobs-Review-Filtered.json`
  * `Results/Glassdoor-Jobs-Review-Filtered.html` + `Results/Glassdoor-Jobs-Review-Filtered.json`

Filtered review behavior:

* Emails are sorted latest first.
* Duplicate jobs are kept in the latest email only.
* The same jobs are removed from older emails.
* Any email with `0` jobs after filtering is omitted from the filtered output.
* For Glassdoor, the filtered review also applies the salary filter configured in [`src/config.ts`](/c:/dev/yhtang/node-js/gmail/src/config.ts).

Open the generated files in [`Results`](/c:/dev/yhtang/node-js/gmail/Results) to review the outputs.

### Cleanup scripts

Useful scripts from [`package.json`](/c:/dev/yhtang/node-js/gmail/package.json):

```bash
npm run del:results
npm run del:packages
```

They do the following:

* `del:results`: removes the generated `Results` folder.
* `del:packages`: removes `node_modules`.

## Notes

* If Google returns a 403 during authorization, make sure your Gmail account was added as a test user.
* `npm install` may still show `node-domexception@1.0.0` as deprecated. That warning currently comes from the upstream Google HTTP dependency chain and can be ignored for now.
