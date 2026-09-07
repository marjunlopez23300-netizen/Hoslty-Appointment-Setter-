# Hostly Solutions Web App

A responsive Hostly-branded lead qualification, consultation booking, and admin CRM prototype.

## Requirements

- Node.js 22.13 or newer
- A Supabase project for production data persistence

## Run in VS Code

1. Open this folder in VS Code.
2. Open the integrated terminal.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env.local` and add your Supabase project values.
5. In Supabase, open **SQL Editor** and run `supabase/schema.sql`.
6. Start the app:

   ```bash
   npm run dev
   ```

7. Open `http://localhost:3000`.

## Useful commands

```bash
npm run dev
npm run build
npm run lint
```

## Supabase security

The included schema enables Row Level Security and exposes the tables only to the server-side `service_role` by default. Never place `SUPABASE_SERVICE_ROLE_KEY` in browser code or rename it with a `NEXT_PUBLIC_` prefix.

The current UI uses demonstration records. Connect form and admin actions through server-side route handlers before collecting real customer information.
