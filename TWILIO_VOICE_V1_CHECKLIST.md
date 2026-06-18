# Twilio Voice V1 — Manual Test Checklist

Click-to-call bridge with recording saved to the qualified business record.

## Prerequisites

- [ ] Twilio account with a **Voice-capable** phone number
- [ ] `.env` configured:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER` (your Twilio voice number)
  - `FOUNDER_PHONE` (Jaylan's mobile, E.164 e.g. `+14095551234`)
  - `PUBLIC_BASE_URL` (production URL or ngrok HTTPS URL — must match what Twilio calls)
- [ ] Logged in to the app (session cookie) — `/api/calls/start` requires auth
- [ ] At least one qualified business with a valid phone in Call Queue

## Local dev with ngrok

1. Start server: `npm run server`
2. Start ngrok: `ngrok http 8787`
3. Set `PUBLIC_BASE_URL=https://YOUR-NGROK-SUBDOMAIN.ngrok-free.app` in `.env`
4. Restart the server after changing env

## Test steps

1. [ ] Open Call Queue (`/call-queue`)
2. [ ] Confirm **Call Direct** fallback link is visible
3. [ ] Click **Call with Recording**
4. [ ] UI shows `Calling your phone…` then success message
5. [ ] Founder phone rings (from `TWILIO_FROM_NUMBER`)
6. [ ] Answer founder phone — hear “Connecting you to [Business Name]…”
7. [ ] Prospect phone rings and call connects
8. [ ] Talk briefly, then hang up
9. [ ] Twilio fires recording webhook (check server logs)
10. [ ] Business record has new `salesCalls[]` entry with:
    - `twilioCallSid`, `twilioRecordingSid`, `recordingUrl`, `durationSec`, `status: completed`
11. [ ] Business record has new `salesNotes[]` note with duration and Recording SID
12. [ ] `data/call-sessions.json` (or Blob equivalent) has session with status events

## Verify business record

```bash
node -e "import('./src/stage1/qualified-business-store.js').then(async m => console.log(JSON.stringify((await m.getQualifiedBusiness('BUSINESS_ID'))?.salesCalls, null, 2)))"
```

Replace `BUSINESS_ID` with the lead id from Call Queue.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| 401 on Call with Recording | Not logged in — POST `/api/login` first |
| 400 Missing PUBLIC_BASE_URL | Set env and restart |
| Founder phone never rings | Wrong `FOUNDER_PHONE` or Twilio trial geo restrictions |
| Connect says session unavailable | `PUBLIC_BASE_URL` mismatch vs ngrok URL |
| Recording webhook 403 | Twilio signature failed — URL must exactly match `PUBLIC_BASE_URL` + path |
| No `salesCalls[]` after call | Recording callback not received — check Twilio debugger |

## Out of scope (V1)

- Transcripts, AI analysis, Blob audio download, browser softphone, SMS/A2P
