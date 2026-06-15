# Render Deployment

This project is ready to run on Render as a single Web Service.

## Recommended setup

- Service type: `Web Service`
- Runtime: `Node`
- Root directory: `backend`
- Build command:

```bash
npm --prefix ../unitech-frontend install && npm --prefix ../unitech-frontend run build
```

- Start command:

```bash
npm start
```

## Environment variables

Set these in the Render dashboard:

```bash
PORT=5000
JWT_SECRET=your-strong-jwt-secret
DATABASE_HOST=your-supabase-host
DATABASE_PORT=5432
DATABASE_USER=your-supabase-user
DATABASE_PASSWORD=your-supabase-password
DATABASE_NAME=postgres
DATABASE_SSL=true
```

Optional overrides:

```bash
DATABASE_URL=
SUPABASE_DATABASE_URL=
POSTGRES_POOLER_URL=
POSTGRES_POOLER_UR=
```

## Notes

- Do not run the Vite dev server in production.
- The backend serves the built frontend from `unitech-frontend/dist`.
- The frontend uses `/api` as its default API base URL, so it works on the same domain as the backend.
- Render must point traffic to the backend service URL. The app will then run on one public port only.

## Checklist before deploy

- Backend connects successfully to PostgreSQL/Supabase.
- `npm --prefix unitech-frontend run build` succeeds locally.
- `npm start` works from the `backend` folder.
- `http://localhost:5000` renders the frontend build locally.
