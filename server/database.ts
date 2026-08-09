import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

interface Migration {
  version: number
  name: string
  sql: string
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'normalized application schema',
    sql: `
      CREATE TABLE profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        display_name TEXT NOT NULL DEFAULT '',
        age INTEGER CHECK (age IS NULL OR age >= 0),
        height_cm REAL CHECK (height_cm IS NULL OR height_cm > 0),
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        weight_unit TEXT NOT NULL DEFAULT 'lb' CHECK (weight_unit IN ('lb', 'kg')),
        timezone TEXT NOT NULL DEFAULT 'Asia/Singapore',
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE challenges (
        id TEXT NOT NULL PRIMARY KEY,
        title TEXT NOT NULL,
        start_date TEXT NOT NULL,
        duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 3650),
        start_weight_grams INTEGER CHECK (start_weight_grams IS NULL OR start_weight_grams > 0),
        goal_weight_grams INTEGER CHECK (goal_weight_grams IS NULL OR goal_weight_grams > 0),
        status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'archived')),
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE habits (
        id TEXT NOT NULL,
        challenge_id TEXT NOT NULL REFERENCES challenges(id),
        name TEXT NOT NULL,
        hint TEXT,
        icon TEXT NOT NULL,
        cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
        weekly_target INTEGER CHECK (weekly_target IS NULL OR weekly_target > 0),
        weekly_bonus INTEGER CHECK (weekly_bonus IS NULL OR weekly_bonus > 0),
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        active_from TEXT NOT NULL,
        active_until TEXT,
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (id),
        UNIQUE (challenge_id, id),
        CHECK (active_until IS NULL OR active_until >= active_from)
      );

      CREATE INDEX habits_challenge_order ON habits(challenge_id, sort_order);

      CREATE TABLE habit_metrics (
        id TEXT NOT NULL,
        challenge_id TEXT NOT NULL,
        habit_id TEXT NOT NULL,
        label TEXT NOT NULL,
        unit TEXT NOT NULL,
        target REAL,
        step REAL NOT NULL CHECK (step > 0),
        minimum REAL NOT NULL,
        maximum REAL NOT NULL,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (id),
        UNIQUE (challenge_id, id),
        FOREIGN KEY (challenge_id, habit_id) REFERENCES habits(challenge_id, id),
        CHECK (maximum >= minimum)
      );

      CREATE INDEX habit_metrics_habit_order ON habit_metrics(habit_id, sort_order);

      CREATE TABLE habit_entries (
        challenge_id TEXT NOT NULL,
        habit_id TEXT NOT NULL,
        entry_date TEXT NOT NULL,
        completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (challenge_id, habit_id, entry_date),
        FOREIGN KEY (challenge_id, habit_id) REFERENCES habits(challenge_id, id)
      );

      CREATE INDEX habit_entries_date ON habit_entries(challenge_id, entry_date);

      CREATE TABLE metric_entries (
        challenge_id TEXT NOT NULL,
        metric_id TEXT NOT NULL,
        entry_date TEXT NOT NULL,
        value REAL NOT NULL,
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (challenge_id, metric_id, entry_date),
        FOREIGN KEY (challenge_id, metric_id) REFERENCES habit_metrics(challenge_id, id)
      );

      CREATE INDEX metric_entries_date ON metric_entries(challenge_id, entry_date);

      CREATE TABLE journals (
        challenge_id TEXT NOT NULL REFERENCES challenges(id),
        entry_date TEXT NOT NULL,
        win TEXT NOT NULL DEFAULT '',
        gratitude TEXT NOT NULL DEFAULT '',
        feeling TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (challenge_id, entry_date)
      );

      CREATE TABLE weekly_reflections (
        challenge_id TEXT NOT NULL REFERENCES challenges(id),
        week_index INTEGER NOT NULL CHECK (week_index >= 0),
        energy INTEGER CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
        mood INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
        win TEXT NOT NULL DEFAULT '',
        intention TEXT NOT NULL DEFAULT '',
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (challenge_id, week_index)
      );

      CREATE TABLE check_ins (
        id TEXT NOT NULL PRIMARY KEY,
        challenge_id TEXT NOT NULL REFERENCES challenges(id),
        entry_date TEXT NOT NULL,
        weight_grams INTEGER CHECK (weight_grams IS NULL OR weight_grams > 0),
        mood INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
        energy INTEGER CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
        notes TEXT,
        version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE INDEX check_ins_challenge_date ON check_ins(challenge_id, entry_date);

      CREATE TABLE sync_devices (
        device_id TEXT NOT NULL PRIMARY KEY,
        last_seen_at TEXT NOT NULL,
        last_cursor INTEGER NOT NULL DEFAULT 0 CHECK (last_cursor >= 0)
      );

      CREATE TABLE sync_changes (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        mutation_id TEXT NOT NULL UNIQUE,
        device_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        base_version INTEGER NOT NULL CHECK (base_version >= 0),
        record_version INTEGER NOT NULL CHECK (record_version > 0),
        operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
        changed_fields TEXT NOT NULL CHECK (json_valid(changed_fields)),
        payload TEXT NOT NULL CHECK (json_valid(payload)),
        created_at TEXT NOT NULL,
        FOREIGN KEY (device_id) REFERENCES sync_devices(device_id)
      );

      CREATE INDEX sync_changes_entity ON sync_changes(entity_type, entity_id, sequence);
    `,
  },
  {
    version: 2,
    name: 'preserve client mutation timestamps',
    sql: `
      ALTER TABLE sync_changes ADD COLUMN client_created_at TEXT;
    `,
  },
]

export function openDatabase(databasePath: string): Database.Database {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  const database = new Database(databasePath)

  try {
    database.pragma('busy_timeout = 5000')
    database.pragma('foreign_keys = ON')
    database.pragma('journal_mode = WAL')
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `)

    database.exec('BEGIN IMMEDIATE')
    try {
      const appliedVersions = new Set(
        database
          .prepare<[], { version: number }>('SELECT version FROM schema_migrations')
          .all()
          .map(({ version }) => version),
      )
      const latestSupportedVersion = migrations.at(-1)?.version ?? 0
      const latestAppliedVersion = Math.max(0, ...appliedVersions)
      if (latestAppliedVersion > latestSupportedVersion) {
        throw new Error(
          `Database uses newer schema version ${latestAppliedVersion}; this binary supports up to ${latestSupportedVersion}.`,
        )
      }

      for (const migration of migrations) {
        if (appliedVersions.has(migration.version)) continue
        database.exec(migration.sql)
        database
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString())
      }
      database.exec('COMMIT')
    } catch (error) {
      if (database.inTransaction) database.exec('ROLLBACK')
      throw error
    }

    return database
  } catch (error) {
    database.close()
    throw error
  }
}
