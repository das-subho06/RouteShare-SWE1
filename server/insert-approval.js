const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    console.log("\n========================================");
    console.log("        DATABASE SCHEMA");
    console.log("========================================\n");

    // --------------------------------------------------
    // 1. TABLES
    // --------------------------------------------------

    const tables = await pool.query(`
      SELECT
        table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log("TABLES:");
    console.table(tables.rows);

    // --------------------------------------------------
    // 2. COLUMNS / ATTRIBUTES
    // --------------------------------------------------

    const columns = await pool.query(`
      SELECT
        c.table_name,
        c.ordinal_position,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
      ORDER BY
        c.table_name,
        c.ordinal_position;
    `);

    console.log("\n========================================");
    console.log("        COLUMNS / ATTRIBUTES");
    console.log("========================================\n");

    console.table(columns.rows);

    // --------------------------------------------------
    // 3. CONSTRAINTS
    // --------------------------------------------------

    const constraints = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc

      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name

      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema

      WHERE tc.table_schema = 'public'

      ORDER BY
        tc.table_name,
        tc.constraint_type,
        tc.constraint_name,
        kcu.ordinal_position;
    `);

    console.log("\n========================================");
    console.log("        CONSTRAINTS");
    console.log("========================================\n");

    console.table(constraints.rows);

    // --------------------------------------------------
    // 4. FOREIGN KEYS ONLY
    // --------------------------------------------------

    const foreignKeys = await pool.query(`
      SELECT
        tc.table_name AS table_name,
        kcu.column_name AS column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        tc.constraint_name
      FROM information_schema.table_constraints tc

      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema

      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema

      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'

      ORDER BY
        tc.table_name,
        kcu.column_name;
    `);

    console.log("\n========================================");
    console.log("        FOREIGN KEYS");
    console.log("========================================\n");

    console.table(foreignKeys.rows);

    // --------------------------------------------------
    // 5. UNIQUE CONSTRAINTS
    // --------------------------------------------------

    const uniqueConstraints = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc

      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema

      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'

      ORDER BY
        tc.table_name,
        tc.constraint_name,
        kcu.ordinal_position;
    `);

    console.log("\n========================================");
    console.log("        UNIQUE CONSTRAINTS");
    console.log("========================================\n");

    console.table(uniqueConstraints.rows);

  } catch (error) {
    console.error("\n❌ DATABASE ERROR:");
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();