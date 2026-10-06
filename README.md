# Mercado Los Laureles — frontend

Standalone Vite frontend export. The API server is intentionally not included.

## Deploy on Vercel

Use this folder as the Vercel project root. The included `vercel.json` builds with `vite build`, publishes `dist`, and provides a history fallback for client-side routes.

Copy `.env.example` to `.env` for local development and set `VITE_CLERK_PUBLISHABLE_KEY`. Set `VITE_API_BASE_URL` to the origin of the separately deployed API (without a trailing slash); leave it blank only when API routes are provided on the same domain. `VITE_CLERK_PROXY_URL` is optional and defaults to the API origin plus `/api/__clerk` in production.

The API host must allow the deployed frontend origin, credentialed requests, and the Clerk proxy route. Configure these public frontend variables in Vercel before using sign-in or API-backed features. Never put server secrets in `VITE_` variables.
