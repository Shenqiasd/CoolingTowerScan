# Platform Environment Matrix

## Overview

CoolingTowerScan Wave 0 is split into three deployable services:

- `web`: Vite front-end
- `api`: Fastify business API
- `detection`: FastAPI inference service

Only browser-safe variables should be exposed through `VITE_*`. Secrets stay on `api` and `detection`.

## Web

Service root:

- repo root

Key environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Supabase project URL for browser reads and temporary direct reads |
| `VITE_SUPABASE_ANON_KEY` | yes | Supabase anon key for browser client |
| `VITE_API_BASE_URL` | yes | Base URL for the new Fastify API service |
| `VITE_DETECTION_API_URL` | yes | Base URL for the detection service |
| `VITE_AMAP_API_KEY` | yes | AMap browser key for map search and screenshot flow |

Notes:

- `web` must never receive `SUPABASE_SERVICE_ROLE_KEY`.
- `VITE_API_BASE_URL` should point at the Railway `api` service domain, not Supabase.

## API

Service root:

- `api/`

Key environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `HOST` | no | Bind host, defaults to `0.0.0.0` |
| `PORT` | yes | Runtime port from Railway/local shell |
| `SUPABASE_URL` | yes | Supabase project URL for server-side admin client |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only admin key for authoritative writes |
| `SUPABASE_JWT_SECRET` | no | Optional legacy JWT secret for local token verification; omit to let the API validate tokens through Supabase |

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is required and server-only.
- `SUPABASE_JWT_SECRET` is optional; when omitted, the API falls back to Supabase `auth.getUser()` verification.
- `api` should be the only service that performs governed workflow writes.

## Detection

Service root:

- `detection/`

Key environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | yes | FastAPI listen port |
| `MODEL_PATH` | yes | YOLO weight path, typically `weights/best.pt` |
| `CORS_ALLOW_ORIGINS` | yes | Comma-separated allowed origins for `web` |

Notes:

- `MODEL_PATH` should resolve inside the `detection` service container or working directory.
- `CORS_ALLOW_ORIGINS` should include the Railway `web` domain and local dev origin if needed.

## Local Development Example

Suggested local shape:

- `web`: `.env.local`
- `api`: shell env or `api/.env`
- `detection`: shell env or service config

Minimum local handoff:

1. Start `detection`.
2. Start `api` with valid Supabase server secrets.
3. Start `web` with `VITE_API_BASE_URL` and `VITE_DETECTION_API_URL` pointing at the local services.

## Railway Mapping

Recommended Railway mapping:

| Railway service | Repo root | Public URL consumer |
| --- | --- | --- |
| `web` | repo root | end users / internal operators |
| `api` | `api/` | `web` |
| `detection` | `detection/` | `web` and `api` if needed later |
