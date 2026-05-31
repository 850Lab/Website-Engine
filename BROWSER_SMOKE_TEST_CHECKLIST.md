# Browser Smoke Test Checklist

Use this checklist before relying on Mission Control for a real outreach session.

## Setup
- Start the API server with `npm run server`.
- Start the Vite dev UI with `npm run web:dev`, or build and serve the production app with `npm run web:build` then `npm run server`.
- Confirm `/login` loads in a fresh browser session.

## Manual Acquisition Loop
- Login with the admin account.
- Open `/mission-control` and confirm real lead counts load.
- Open `/lead-generation`.
- Enter a Run Title, niche/search term, city/state, max results, and filters.
- Run lead generation and watch logs until the run completes.
- Open the saved Target Lead Group from the completed run.
- Confirm qualified and rejected leads display with reasons.
- Open one qualified lead detail page.
- Generate/refresh preview.
- Prepare assets.
- Render screenshots.
- Open `/leads/:id/preview` and inspect live preview plus desktop/mobile screenshots.
- Approve preview for outreach.
- Open `/outreach`.
- Confirm the approved lead appears in Ready for Outreach.
- Generate/copy outreach draft.
- Mark contacted.
- Schedule a follow-up.
- Confirm the lead appears in Waiting for Reply or Follow-Up when due.
- Complete or snooze the follow-up.
- Mark the lead replied, won, or lost.
- Return to Mission Control and Target Lead Group detail to confirm stats updated.

## Manual Lead Entry
- Open `/leads/new`.
- Create a single manual lead.
- Paste/import a lead text block.
- Assign a lead to a Target Lead Group.
- Enrich or generate a preview after save.

## Persistence
- Stop and restart `npm run server`.
- Refresh `/mission-control`.
- Confirm login/session still works if the browser cookie is valid.
- Confirm lead status, follow-up, preview approval, and Target Lead Group changes persisted.

## Safety / Admin
- Open `/settings`.
- Confirm admin account status, counts, preview/render counts, OpenAI key status, Playwright status, and last backup timestamp display.
- Run test-data cleanup preview.
- Only run confirmed cleanup if the matched records are clearly E2E/TEST records.

## CLI
- Run `npm run outreach -- list`.
- Optionally run `npm run outreach -- cleanup-test-records --dry-run`.
