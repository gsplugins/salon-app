# Backend Structure (Clean + Scalable)

This backend is now organized around predictable layers:

- `src/app.ts` - app bootstrap, middleware, and global error handling.
- `src/routes/index.ts` - central API route composition.
- `src/routes/*.ts` - HTTP route modules grouped by role/domain.
- `src/lib/*.ts` - reusable utilities (`jwt`, `http`, `supabase`, helpers).
- `src/middleware/*.ts` - cross-cutting request middleware.
- `src/presenters/*.ts` - response shaping for API payloads.
- `src/types/*.d.ts` - shared ambient typings.
- `supabase/schema.sql` - canonical full schema snapshot.
- `supabase/migrations/*.sql` - incremental production migrations.

## Recommended next split (optional, for future growth)

When the codebase grows further, move route files into feature folders:

- `src/features/auth/*`
- `src/features/public/*`
- `src/features/shop-owner/*`
- `src/features/staff/*`
- `src/features/customer/*`
- `src/features/admin/*`

Each feature can hold:

- `routes.ts`
- `service.ts` (business logic)
- `repo.ts` (database queries)
- `schemas.ts` (validation)

This keeps handlers small and helps maintain performance work per domain.
