import { neon } from "@neondatabase/serverless";

/**
 * Temporary shared DB while the old Supabase project is dead.
 * Prefer env; fallback keeps production in sync without Vercel dashboard access.
 * Rotate this password after reconnecting a proper Supabase/Neon env on Vercel.
 */
const FALLBACK_DATABASE_URL =
  "postgresql://neondb_owner:npg_jDewZSs3zN2J@ep-proud-scene-bhjjybdh-pooler.c-10.eu-central-1.aws.neon.tech/neondb?sslmode=require";

/** Shared Postgres for guest/local mode when Supabase is down. */
export function getDatabaseUrl(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    FALLBACK_DATABASE_URL ||
    null
  );
}

export function hasRemoteDb() {
  return Boolean(getDatabaseUrl());
}

export function sqlClient() {
  const url = getDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}
