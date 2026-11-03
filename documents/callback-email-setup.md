# Direct Gmail email from the backend

The callback flow is frontend → backend → Gmail. The backend sends the message
during the request and returns its result. Supabase is only the website CMS;
email submissions create no inquiry rows, SQL queue jobs or local files.

## Activate Gmail

1. Sign in to Google as roniellatours@gmail.com.
2. Enable [2-Step Verification](https://myaccount.google.com/security).
3. Open [App Passwords](https://myaccount.google.com/apppasswords), create an entry
   named RoniElla Vercel, and copy the generated 16-character App Password.
4. In Vercel, open roniella-api → Settings → Environment Variables.
5. Add GMAIL_APP_PASSWORD as a Secret for Production. Enter the App Password
   directly in Vercel; keep it out of Git and chat.
6. Redeploy the backend from main and wait for Ready.

Whitespace in Google's grouped password is removed by the backend. The sender
and recipient default to roniellatours@gmail.com. Optional backend variables
GMAIL_USER and CALLBACK_EMAIL_TO can change those values.

The same Gmail settings work with local file content or Docker. They are
independent of CONTENT_PROVIDER and Supabase credentials. The content API still
uses its existing CMS configuration.

## Delivery and errors

The backend uses Nodemailer with TLS to smtp.gmail.com on port 465 and awaits
SMTP acceptance before returning success. The message includes the name,
normalized phone/country, optional email, destination, source page and consent.
A visitor email is Reply-To, while the server fixes the sender and recipient.

A missing or invalid password makes submission fail visibly. A definite SMTP
failure is returned to the form. An uncertain result after sending is shown as
uncertain; there is no automatic resend. SMTP acceptance does not guarantee
inbox placement.

There is no database inbox, persistent delivery queue or retry-notifications
endpoint. Temporary in-process hashes/counters suppress repeat clicks and limit
requests; separate serverless instances do not share that memory.

## Test

After both applications are deployed, submit one test callback and check
Gmail Inbox, Sent and Spam. Review backend runtime logs for sanitized reason
codes if sending fails. Successful form submission means Gmail accepted the
message, not that a database saved it.

Automated tests mock the mail transport. They never read a real App Password or
send live email. The local browser test API is a separate test script and is
not bundled into either Vercel deployment.

## Migration history

Earlier callback storage/email-queue migrations remain immutable database
history. The current service does not use their tables/functions, and existing
records have not been deleted. The new privacy-copy migration updates only
the CMS text describing the current email-only flow; email delivery has no
database-migration prerequisite.

Sources: [Google App Passwords](https://support.google.com/accounts/answer/185833),
[Vercel environment changes](https://vercel.com/docs/environment-variables/managing-environment-variables),
[SMTP on Vercel](https://vercel.com/kb/guide/serverless-functions-and-smtp),
[Nodemailer Gmail guide](https://nodemailer.com/guides/using-gmail).
