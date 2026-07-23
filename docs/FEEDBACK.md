# User feedback summary

Feedback is collected in-app through the **💬 Feedback** widget, which posts to
`/api/feedback`. Submissions are written as structured JSON to the server logs
(readable in the Vercel dashboard under *Logs*) and, when `FEEDBACK_WEBHOOK_URL`
is configured, mirrored to a Discord/Slack channel in real time.

Each submission captures: rating (1–5), free-text message, optional contact,
connected wallet address (if any), locale, and the page it was sent from.

## How to read the raw feedback

1. Vercel dashboard → project → **Logs**
2. Filter for `[feedback]`
3. Each line is a JSON object, e.g.
   ```json
   {"rating":4,"message":"Refund guarantee is the selling point","locale":"en","path":"/campaigns/0","timestamp":"..."}
   ```

## Summary

_Filled in as testers report back. Update the counts and themes below._

**Responses:** _n_ · **Average rating:** _x.x / 5_

### What worked well

- _e.g. "Support flow is fast, the tx status states made it obvious what was happening"_

### What was confusing / broken

- _e.g. "Didn't realise I had to fund the wallet before supporting"_

### Feature requests

- _e.g. "Show a campaign description, not just a title"_

### Actions taken

| Feedback theme | Change made | Commit |
|---|---|---|
| _theme_ | _what changed_ | _hash_ |
