# Database

Supabase files live under `database/supabase/`:

- `config.toml`: local database and API settings.
- `migrations/`: ordered SQL schema and content migrations.
- `seed.sql`: bootstrap content for an empty database only.

The nested `supabase/` folder keeps the standard Supabase CLI layout. From the
repository root, use the wrapper that selects `database/` as the working directory:

```powershell
npm.cmd run db:cli -- --help
npm.cmd run db:cli -- migration new describe_the_change
npm.cmd run db:cli -- db push --remote --dry-run
```

The equivalent direct command is `npx.cmd supabase --workdir database <command>`.
The existing ignored project link state moved with this folder; a fresh checkout
needs `npm.cmd run db:cli -- link --project-ref YOUR_PROJECT_REF`.

Local validation uses ephemeral PostgreSQL and does not contact the hosted project:

```powershell
npm.cmd run db:verify
```

Run `npm.cmd run db:seed` only to regenerate and review the local bootstrap file.
Do not reapply it to the populated hosted database. Moving this folder requires
no hosted SQL changes. Future migrations are applied explicitly after review,
never by the application build or startup commands.

See the [deployment guide](../documents/deployment.md) for backups and release order.
