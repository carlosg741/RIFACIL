import { existsSync, mkdirSync } from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

export type Db = ReturnType<typeof createNeonDb> | ReturnType<typeof createPgliteDb>;

declare global {
  // eslint-disable-next-line no-var
  var __rifacilDb: Db | undefined;
  // eslint-disable-next-line no-var
  var __rifacilPglite: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __rifacilSchemaReady: Promise<void> | undefined;
}

function createNeonDb(url: string) {
  const sql = neon(url);
  return drizzleNeon({ client: sql, schema });
}

function createPgliteDb(client: PGlite) {
  return drizzlePglite({ client, schema });
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

function isNeonUrl(url: string) {
  return (
    url.startsWith("postgres://") ||
    url.startsWith("postgresql://") ||
    url.includes("neon.tech")
  );
}

async function getPglite() {
  if (globalThis.__rifacilPglite) return globalThis.__rifacilPglite;
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  if (!existsSync(path.dirname(dataDir))) {
    mkdirSync(path.dirname(dataDir), { recursive: true });
  }
  const client = new PGlite(dataDir);
  await client.waitReady;
  globalThis.__rifacilPglite = client;
  return client;
}

export async function getDb(): Promise<Db> {
  if (globalThis.__rifacilDb) return globalThis.__rifacilDb;

  const url = getDatabaseUrl();
  if (url && isNeonUrl(url)) {
    globalThis.__rifacilDb = createNeonDb(url);
    return globalThis.__rifacilDb;
  }

  const client = await getPglite();
  globalThis.__rifacilDb = createPgliteDb(client);
  return globalThis.__rifacilDb;
}

const SCHEMA_SQL = `
DO $$ BEGIN
  CREATE TYPE raffle_status AS ENUM ('draft', 'active', 'closed', 'drawn');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('available', 'reserved', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending_payment', 'under_review', 'paid', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE donation_status AS ENUM ('pending_payment', 'under_review', 'confirmed', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_platform boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'client',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS raffles (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  prize text NOT NULL,
  image_url text,
  price_per_ticket numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'PEN',
  total_tickets integer NOT NULL,
  reservation_minutes integer NOT NULL DEFAULT 30,
  draw_at timestamptz,
  status raffle_status NOT NULL DEFAULT 'draft',
  winner_count integer NOT NULL DEFAULT 1,
  donations_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS raffles_org_slug_idx ON raffles(organization_id, slug);
CREATE INDEX IF NOT EXISTS raffles_slug_idx ON raffles(slug);

CREATE TABLE IF NOT EXISTS raffle_prizes (
  id text PRIMARY KEY,
  raffle_id text NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image_url text,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS raffle_prizes_raffle_position_idx
  ON raffle_prizes(raffle_id, position);

CREATE TABLE IF NOT EXISTS raffle_currencies (
  id text PRIMARY KEY,
  raffle_id text NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  code text NOT NULL,
  price_per_ticket numeric(12,2) NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS raffle_currencies_raffle_code_idx
  ON raffle_currencies(raffle_id, code);
CREATE INDEX IF NOT EXISTS raffle_currencies_raffle_idx
  ON raffle_currencies(raffle_id);

CREATE TABLE IF NOT EXISTS payment_methods (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  raffle_id text REFERENCES raffles(id) ON DELETE SET NULL,
  name text NOT NULL,
  instructions text NOT NULL,
  account_info text,
  account_holder text,
  qr_image_url text,
  currency text,
  contact_email text,
  document_id text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_methods_raffle_idx ON payment_methods(raffle_id);

CREATE TABLE IF NOT EXISTS donations (
  id text PRIMARY KEY,
  raffle_id text NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  payment_method_id text REFERENCES payment_methods(id) ON DELETE SET NULL,
  status donation_status NOT NULL DEFAULT 'pending_payment',
  amount numeric(12,2) NOT NULL,
  currency text,
  donor_name text NOT NULL,
  donor_phone text NOT NULL,
  donor_email text,
  proof_url text,
  proof_file_name text,
  notes text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS donations_raffle_status_idx ON donations(raffle_id, status);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  raffle_id text NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  payment_method_id text REFERENCES payment_methods(id) ON DELETE SET NULL,
  status order_status NOT NULL DEFAULT 'pending_payment',
  total_amount numeric(12,2) NOT NULL,
  currency text,
  ticket_count integer NOT NULL,
  participant_name text NOT NULL,
  participant_phone text NOT NULL,
  participant_email text,
  notes text,
  reserved_until timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_raffle_status_idx ON orders(raffle_id, status);

CREATE TABLE IF NOT EXISTS tickets (
  id text PRIMARY KEY,
  raffle_id text NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number integer NOT NULL,
  status ticket_status NOT NULL DEFAULT 'available',
  order_id text,
  reserved_until timestamptz,
  participant_name text,
  participant_phone text,
  participant_email text,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS tickets_raffle_number_idx ON tickets(raffle_id, number);
CREATE INDEX IF NOT EXISTS tickets_raffle_status_idx ON tickets(raffle_id, status);

CREATE TABLE IF NOT EXISTS payment_proofs (
  id text PRIMARY KEY,
  order_id text NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  mime_type text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS draws (
  id text PRIMARY KEY,
  raffle_id text NOT NULL UNIQUE REFERENCES raffles(id) ON DELETE CASCADE,
  seed text NOT NULL,
  drawn_at timestamptz DEFAULT now() NOT NULL,
  paid_ticket_count integer NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS draw_winners (
  id text PRIMARY KEY,
  draw_id text NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_number integer NOT NULL,
  prize_position integer NOT NULL,
  participant_name text,
  participant_phone text
);
`;

/** Migraciones ligeras: CREATE IF NOT EXISTS no añade columnas a tablas ya existentes. */
const MIGRATIONS = [
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_holder text`,
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS qr_image_url text`,
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_info text`,
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS raffle_id text`,
  `ALTER TABLE raffles ADD COLUMN IF NOT EXISTS donations_enabled boolean NOT NULL DEFAULT false`,
  `DO $$ BEGIN
    CREATE TYPE donation_status AS ENUM ('pending_payment', 'under_review', 'confirmed', 'rejected');
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `CREATE TABLE IF NOT EXISTS donations (
    id text PRIMARY KEY,
    raffle_id text NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    payment_method_id text REFERENCES payment_methods(id) ON DELETE SET NULL,
    status donation_status NOT NULL DEFAULT 'pending_payment',
    amount numeric(12,2) NOT NULL,
    donor_name text NOT NULL,
    donor_phone text NOT NULL,
    donor_email text,
    proof_url text,
    proof_file_name text,
    notes text,
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS donations_raffle_status_idx ON donations(raffle_id, status)`,
  `CREATE INDEX IF NOT EXISTS payment_methods_raffle_idx ON payment_methods(raffle_id)`,
  // Asigna métodos huérfanos a la rifa más reciente de su organización
  `UPDATE payment_methods pm
   SET raffle_id = (
     SELECT r.id FROM raffles r
     WHERE r.organization_id = pm.organization_id
     ORDER BY r.created_at DESC
     LIMIT 1
   )
   WHERE pm.raffle_id IS NULL`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_platform boolean NOT NULL DEFAULT false`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true`,
  `CREATE TABLE IF NOT EXISTS raffle_prizes (
    id text PRIMARY KEY,
    raffle_id text NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    image_url text,
    position integer NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS raffle_prizes_raffle_position_idx
   ON raffle_prizes(raffle_id, position)`,
  // Conserva las rifas existentes como un primer premio.
  `INSERT INTO raffle_prizes (
     id, raffle_id, title, image_url, position
   )
   SELECT
     r.id || '-legacy-prize', r.id, r.prize, r.image_url, 1
   FROM raffles r
   WHERE NOT EXISTS (
     SELECT 1 FROM raffle_prizes rp WHERE rp.raffle_id = r.id
   )`,
  // Org rifacil (o la más antigua) → plataforma; su admin legado → super_admin
  `UPDATE organizations
   SET is_platform = true
   WHERE id = COALESCE(
     (SELECT id FROM organizations WHERE slug = 'rifacil' LIMIT 1),
     (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1)
   )`,
  `UPDATE users
   SET role = 'super_admin'
   WHERE organization_id IN (
     SELECT id FROM organizations WHERE is_platform = true
   )
   AND role IN ('admin', 'super_admin')`,
  // Multi-moneda: monedas por rifa, moneda por método y por orden/donación
  `CREATE TABLE IF NOT EXISTS raffle_currencies (
    id text PRIMARY KEY,
    raffle_id text NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    code text NOT NULL,
    price_per_ticket numeric(12,2) NOT NULL,
    position integer NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS raffle_currencies_raffle_code_idx
   ON raffle_currencies(raffle_id, code)`,
  `CREATE INDEX IF NOT EXISTS raffle_currencies_raffle_idx
   ON raffle_currencies(raffle_id)`,
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS currency text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency text`,
  `ALTER TABLE donations ADD COLUMN IF NOT EXISTS currency text`,
  // Conserva la moneda y precio actuales de cada rifa como moneda principal
  `INSERT INTO raffle_currencies (id, raffle_id, code, price_per_ticket, position)
   SELECT r.id || '-legacy-currency', r.id, r.currency, r.price_per_ticket, 1
   FROM raffles r
   WHERE NOT EXISTS (
     SELECT 1 FROM raffle_currencies rc WHERE rc.raffle_id = r.id
   )`,
  // Conservar métodos de pago al borrar una rifa (solo desasignarlos)
  `DO $$ BEGIN
     ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_raffle_id_fkey;
   EXCEPTION WHEN undefined_object THEN NULL;
   END $$`,
  `DO $$ BEGIN
     ALTER TABLE payment_methods
       ADD CONSTRAINT payment_methods_raffle_id_fkey
       FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS requires_document_id boolean NOT NULL DEFAULT false`,
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS requires_email boolean NOT NULL DEFAULT false`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS participant_document_id text`,
  `ALTER TABLE donations ADD COLUMN IF NOT EXISTS donor_document_id text`,
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS contact_email text`,
  `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS document_id text`,
];

async function applyMigrations() {
  const url = getDatabaseUrl();
  if (url && isNeonUrl(url)) {
    const client = neon(url);
    for (const statement of MIGRATIONS) {
      await client.query(statement);
    }
    return;
  }
  const client = await getPglite();
  for (const statement of MIGRATIONS) {
    await client.exec(statement);
  }
}

export async function ensureSchema() {
  // Ejecuta schema base + migraciones UNA sola vez por instancia del servidor.
  // Antes las migraciones (decenas de sentencias) corrían en cada llamada, lo
  // que hacía muy lento el panel: cada página abría decenas de round-trips a la
  // base de datos. Cachear en un único promise evita esa latencia.
  if (!globalThis.__rifacilSchemaReady) {
    globalThis.__rifacilSchemaReady = (async () => {
      const url = getDatabaseUrl();
      if (url && isNeonUrl(url)) {
        // Neon: aplicar schema base (CREATE IF NOT EXISTS) igual que PGlite
        const client = neon(url);
        // El driver HTTP ejecuta una sentencia a la vez; separar con cuidado
        // de bloques DO $$ ... $$;
        const parts = splitSqlStatements(SCHEMA_SQL);
        for (const statement of parts) {
          await client.query(statement);
        }
      } else {
        const client = await getPglite();
        await client.exec(SCHEMA_SQL);
      }
      // Añade columnas/índices nuevos sin borrar datos existentes
      await applyMigrations();
    })();
  }
  try {
    await globalThis.__rifacilSchemaReady;
  } catch (err) {
    // Si falló, permite reintentar en la próxima llamada
    globalThis.__rifacilSchemaReady = undefined;
    throw err;
  }
}

/** Separa SQL en statements, respetando bloques DO $$ … $$. */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    const next = sql[i + 1];
    if (ch === "$" && next === "$") {
      inDollar = !inDollar;
      current += "$$";
      i++;
      continue;
    }
    if (ch === ";" && !inDollar) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }
  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}
