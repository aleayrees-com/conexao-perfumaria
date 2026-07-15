# Conexão Perfumaria

Independent e-commerce storefront for Conexão Perfumaria, built to operate outside a restricted Nuvemshop checkout flow.

## Overview

The application provides a branded catalog and local cart, then sends the order summary to WhatsApp for checkout. Supabase is the operational catalog source when configured; a local product JSON file is used as a fallback when the database or environment configuration is unavailable.

## Features

- Product catalog imported from public Nuvemshop pages and sitemap data.
- Product search, category filtering, stock status, variants, and images.
- Local shopping cart and WhatsApp order handoff.
- Server-side Supabase catalog access with a local JSON fallback.
- Scripts for Nuvemshop import, Supabase import, and database migration.
- Foundation for future payment, shipping, and administration features.

## Tech stack

- Node.js 24 and npm 11
- Next.js 16
- React 19
- TypeScript 5.9
- Supabase
- Vitest, ESLint, and Prettier

## Getting started

Install the dependencies and create a local environment file:

```bash
npm ci
Copy-Item .env.example .env.local
```

Configure the values used by the catalog and order flow:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

Run the development server:

```bash
npm run dev
```

Without `SUPABASE_SERVICE_ROLE_KEY`, the application falls back to its local `src/data/products.json` catalog.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Lint and build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite |
| `npm run import:nuvemshop` | Import catalog data from Nuvemshop |
| `npm run import:supabase` | Import products into Supabase |
| `npm run migrate:supabase` | Apply the Supabase migration |

## Production

The project runs on any Node-compatible hosting platform:

```bash
npm ci
npm run build
npm start
```

Keep `.env.local` private and rotate the Supabase service-role key before a final production deployment. See [DEPLOY.md](DEPLOY.md) for the deployment-specific notes.
