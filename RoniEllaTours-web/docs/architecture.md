# Future Integration Note

This phase is frontend-only. The form components call no live backend and expose no secrets.

Recommended next step:

1. Keep UI validation in the React components.
2. Add a small service wrapper in `src/services/forms.js` that posts to server-side endpoints.
3. Create Vercel Serverless Functions under `api/` or connect another backend selected later.
4. Put provider credentials in server-side environment variables only.
5. Have the server endpoint handle email notifications, webhooks, spam checks, and persistence.

No database, authentication provider, email provider, webhook destination, or Firebase project has been chosen in this phase.
