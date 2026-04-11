# Privacy Policy

Last updated: 2026-04-11

GitHub Actions Log Copy is a browser extension that adds a copy button to GitHub Actions job step headers.

## What this extension accesses

The extension runs only on `https://github.com/*` and only activates on GitHub Actions job log pages that match:

`https://github.com/<owner>/<repo>/actions/runs/<run-id>/job/<job-id>`

On those pages, the extension reads the page structure needed to:

- identify GitHub Actions step headers
- insert a copy button into each step header
- read the selected step's visible log lines
- fetch the selected step's GitHub-hosted log fragment when needed to capture long virtualized logs

## What this extension does with data

This extension:

- does not collect personal information
- does not send data to any third-party server
- does not use analytics or tracking
- does not store browsing history, account data, or copied logs
- only writes text to the clipboard after the user explicitly clicks the copy button

When the extension fetches a step log fragment, it makes that request only to GitHub using the authenticated browser session that is already active in the user's browser.

## Clipboard access

The extension uses clipboard access only to copy the selected step's log text after a user clicks the copy button.

## Data retention

The extension does not retain copied logs or other user data.

## Changes

If this privacy policy changes, the updated version will be published at:

`https://oliverio.dev/privacy/github-actions-log-copy/`

## Contact

Project homepage:

`https://oliverio.dev/projects/github-actions-log-copy/`

Support and issues:

`https://github.com/toliv/gha-log-copy/issues`
