# CoolingTowerScan API

## Purpose

`api/` is the Wave 0 Fastify service that will become the workflow authority for candidate, lead, and project writes.

Current Sprint 0.1 scope:

- service bootstrap
- health check
- Supabase admin client wiring
- auth context and protected-route guard
- audit metadata and unified error envelope

## Requirements

- Node.js 20+
- npm 10+

## Install

```bash
cd api
npm ci
```

## Required Environment Variables

```bash
export HOST=0.0.0.0
export PORT=3000
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# optional: export SUPABASE_JWT_SECRET=your-jwt-secret
```

`SUPABASE_JWT_SECRET` is only needed if you want the API to verify Supabase access tokens locally. If it is omitted, the API will validate bearer tokens through Supabase using the service role key.

## Development

Run the API in watch mode:

```bash
cd api
npm run dev
```

## Verification

Type-check:

```bash
cd api
npm run typecheck
```

Run tests:

```bash
cd api
npm test
```

Build production output:

```bash
cd api
npm run build
```

Start the built server:

```bash
cd api
npm run build
npm start
```

Health check after startup:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "api"
}
```

## CI Commands

GitHub Actions runs:

```bash
npm --prefix api ci
npm --prefix api run typecheck
npm --prefix api test
npm --prefix api run build
```
