# Deployment Automation with Backup Retention

This project provides deployment transfer automation for `qa` and `preprod` over SSH with:

- automatic backup before deployment
- rollback points through retained backups
- configurable backup retention per environment
- safe cleanup (dry-run + force guard)
- backup listing with size and timestamps

`dev`, `qa`, and `preprod` server definitions are configured in `deployment.config.json`.

## Configure Retention

Use either `.env` values:

```env
BACKUP_RETENTION_QA=5
BACKUP_RETENTION_PREPROD=10
```

Or `deployment.config.json`:

```json
{
  "backupRetention": {
    "qa": 5,
    "preprod": 10
  }
}
```

CLI `--retain` overrides both.

## Server Mapping

Configure environments in `deployment.config.json`:

- `servers.dev`
- `servers.qa`
- `servers.preprod`

Each server supports:

- `user`
- `host`
- `port` (optional)
- `key` (PEM path)
- `basePath` (deployment destination)
- `jsonPath`
- `cloudfrontDistribution`
- `backupRoot` (remote backup storage)

Use project-root-relative key paths, e.g. `./keys/blazeagrqa.pem` (outside `src`).

## Commands

- Deploy with auto-backup + post-success cleanup:
  - `npm run deploy -- --env=qa`
  - `npm run deploy -- --env=preprod --retain=10`
  - `npm run deploy -- --env=qa --game=golden_vault`
  - `npm run deploy -- --env=qa --game=golden_vault --source=./local/path/to/game`
- List backups:
  - `npm run backups -- --env=qa`
  - `npm run backups -- --env=all`
- Cleanup backups:
  - Preview only: `npm run cleanup -- --env=qa --dry-run`
  - Execute: `npm run cleanup -- --env=qa --force`
  - All envs: `npm run cleanup -- --env=all --force`

## CloudFront Invalidation

- Runs automatically after successful deployment when `cloudfrontDistribution` is configured for the environment.
- Uses the same SSH key and server host to execute:
  - `aws cloudfront create-invalidation --distribution-id <id> --paths '/*'`
- If no distribution is configured, invalidation is skipped.
- If invalidation fails, deployment remains successful and the failure is reported in deploy output.

## Dynamic Game Deployment UI (React + TypeScript)

- Install dependencies:
  - `npm install`
- Backend type check: `npm run typecheck`
- Dev (debug build + standalone server on `4173`): `npm run dev`
- React dev server (hot reload on `5173`): `npm run react:dev`
- Build standalone UI (debug sourcemaps): `npm run web:build:debug`
- Build standalone app (backend + frontend): `npm run app:build`
- Start standalone app (serves built React app + API): `npm run app:start`
- Open: `http://localhost:4173`
- Select:
  - environment (`qa` / `preprod`)
  - dynamic game path (example: `golden_vault` or `slot/pharaoh/golden_vault`)
  - optional local source override
  - optional retention override
- Click Deploy and review JSON result instantly.

## Safety Rules

- cleanup executes automatically only after successful deployment
- oldest backups are removed first
- latest successful backup is never deleted
- explicit `--force` is required for manual cleanup deletion
- cleanup validates backup existence before deletion

