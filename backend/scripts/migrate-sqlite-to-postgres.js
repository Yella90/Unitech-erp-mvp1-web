require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const sourceDbPath = process.env.UNITECH_DB_PATH
  ? path.resolve(process.env.UNITECH_DB_PATH)
  : path.resolve(__dirname, '..', 'database', 'unitech.db');

function safeDecodeUriComponent(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function buildConnectionStringFromParts() {
  const host = String(
    process.env.DATABASE_HOST ||
    process.env.POSTGRES_HOST ||
    process.env.host ||
    process.env.HOST ||
    ''
  ).trim();
  const user = String(
    process.env.DATABASE_USER ||
    process.env.POSTGRES_USER ||
    process.env.user ||
    process.env.USER ||
    ''
  ).trim();
  const password = safeDecodeUriComponent(
    process.env.DATABASE_PASSWORD ||
    process.env.POSTGRES_PASSWORD ||
    process.env.PASSWORD ||
    ''
  );
  const database = String(
    process.env.DATABASE_NAME ||
    process.env.POSTGRES_DB ||
    process.env.Database ||
    process.env.DATABASE ||
    process.env.DB_NAME ||
    'postgres'
  ).trim() || 'postgres';
  const port = String(
    process.env.DATABASE_PORT ||
    process.env.POSTGRES_PORT ||
    process.env.Database_port ||
    process.env.PORT_PG ||
    '5432'
  ).trim() || '5432';

  if (!host || !user) return '';
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = password ? `:${encodeURIComponent(password)}` : '';
  return `postgresql://${encodedUser}${encodedPassword}@${host}:${port}/${database}`;
}

const connectionString =
  buildConnectionStringFromParts() ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.POSTGRES_POOLER_URL ||
  process.env.POSTGRES_POOLER_UR;
if (!connectionString) {
  throw new Error('DATABASE_URL est requis pour migrer vers PostgreSQL/Supabase');
}

const useSsl = String(process.env.DATABASE_SSL || process.env.SUPABASE_SSL || '').toLowerCase() === 'true'
  || /supabase\.co/i.test(connectionString);

function openSqlite(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Base SQLite introuvable: ${dbPath}`);
  }
  return new sqlite3.Database(dbPath);
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function sqliteGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function pgQuery(pool, sql, params = []) {
  return pool.query(sql, params);
}

function sqliteToPostgresType(type) {
  return String(type || '').toUpperCase()
    .replace(/\bDATETIME\b/g, 'TIMESTAMP')
    .replace(/\bINTEGER PRIMARY KEY AUTOINCREMENT\b/g, 'BIGSERIAL PRIMARY KEY')
    .replace(/\bAUTOINCREMENT\b/g, '')
    .replace(/\bINT\b/g, 'INTEGER');
}

function transformCreateStatement(sql = '') {
  return String(sql)
    .replace(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+/i, 'CREATE TABLE IF NOT EXISTS ')
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'BIGSERIAL PRIMARY KEY')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
    .replace(/\bAUTOINCREMENT\b/gi, '');
}

async function createManualPgCompatibility(pool) {
  await pgQuery(pool, `
    CREATE OR REPLACE FUNCTION prevent_inscription_payment_for_exempt_students_fn()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF LOWER(COALESCE(NEW.mois, '')) = 'inscription'
         AND NEW.eleve_id IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM eleves e
           WHERE e.id = NEW.eleve_id
             AND COALESCE(e.exonere_frais_inscription, 0) = 1
         )
      THEN
        RAISE EXCEPTION 'INSCRIPTION_FEE_WAIVED';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);

  await pgQuery(pool, `
    DROP TRIGGER IF EXISTS prevent_inscription_payment_for_exempt_students ON paiements;
    CREATE TRIGGER prevent_inscription_payment_for_exempt_students
    BEFORE INSERT ON paiements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_inscription_payment_for_exempt_students_fn();
  `);

  await pgQuery(pool, `
    DROP TRIGGER IF EXISTS prevent_inscription_payment_update_for_exempt_students ON paiements;
    CREATE TRIGGER prevent_inscription_payment_update_for_exempt_students
    BEFORE UPDATE OF mois, eleve_id ON paiements
    FOR EACH ROW
    EXECUTE FUNCTION prevent_inscription_payment_for_exempt_students_fn();
  `);
}

async function resetTargetSchema(pool, tableNames) {
  const quoted = tableNames.map((name) => `"${name.replace(/"/g, '""')}"`);
  if (quoted.length) {
    await pgQuery(pool, `DROP TABLE IF EXISTS ${quoted.join(', ')} CASCADE`);
  }
}

async function migrate() {
  const sqlite = openSqlite(sourceDbPath);
  const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const tables = await sqliteAll(
      sqlite,
      `SELECT name, sql
         FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY rowid ASC`
    );

    const tableNames = tables.map((row) => row.name);

    await pgQuery(pool, 'BEGIN');
    await resetTargetSchema(pool, tableNames);

    for (const table of tables) {
      if (!table.sql) continue;
      await pgQuery(pool, transformCreateStatement(table.sql));
    }

    const indexes = await sqliteAll(
      sqlite,
      `SELECT name, sql
         FROM sqlite_master
        WHERE type = 'index'
          AND sql IS NOT NULL
          AND name NOT LIKE 'sqlite_%'
        ORDER BY rowid ASC`
    );

    for (const index of indexes) {
      await pgQuery(pool, String(index.sql).replace(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS'));
    }

    await createManualPgCompatibility(pool);

    for (const table of tables) {
      const rows = await sqliteAll(sqlite, `SELECT * FROM "${table.name}"`);
      if (!rows.length) continue;

      const columns = Object.keys(rows[0]);
      const columnList = columns.map((column) => `"${column.replace(/"/g, '""')}"`).join(', ');
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const insertSql = `INSERT INTO "${table.name}" (${columnList}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map((column) => row[column]);
        await pgQuery(pool, insertSql, values);
      }

      const hasIdColumn = columns.includes('id');
      if (hasIdColumn) {
        await pgQuery(
          pool,
          `
          SELECT setval(
            pg_get_serial_sequence($1, 'id'),
            COALESCE((SELECT MAX(id) FROM "${table.name}"), 1),
            true
          )
        `,
          [table.name]
        );
      }
    }

    await pgQuery(pool, 'COMMIT');
    console.log('Migration SQLite -> PostgreSQL terminée avec succès');
  } catch (error) {
    try {
      await pgQuery(pool, 'ROLLBACK');
    } catch (rollbackError) {
      console.error('Erreur rollback migration:', rollbackError);
    }
    throw error;
  } finally {
    sqlite.close();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Migration echouee:', error);
  process.exitCode = 1;
});
