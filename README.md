# RoniElla Tours

The current website is in **[`rebuild/`](rebuild/README.md)**. It contains the
React/Vite/TypeScript server-rendered frontend, Express backend, shared schemas,
and Supabase database migrations and initial content seed.

The `RoniEllaTours-web/` and `RoniEllaTours-backend/` folders are the older version.
Use `rebuild/` for current development and deployment preparation.

## Local development

Install Node 24 (24.11 or newer within Node 24) and npm 11, then run:

```powershell
cd rebuild
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:5173. Local development uses the included content files.

## Validation and deployment

```powershell
cd rebuild
npm.cmd run check:deployment
```

See the [deployment guide](rebuild/documents/deployment.md) and
[design research](rebuild/documents/design-research.md).
The checked-in deployment package currently targets Docker; configuration for
two Vercel projects (frontend and backend) is the next step. Committing this code
does not provision Supabase or run its migrations.

Keep real credentials in ignored environment files or hosting environment
settings. Commit only the supplied environment templates. Local design exports,
browser QA output, dependencies, and Supabase link state are excluded from Git.
