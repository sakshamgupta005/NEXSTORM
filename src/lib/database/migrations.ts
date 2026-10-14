/**
 * Database Migration Utilities & Starter SQL Templates
 * 
 * Provides:
 * - Versioned migration contracts
 * - Standard starter templates for Hackathon PostgreSQL schemas
 * - Migration status inspection
 */

import type { Migration } from './types'

export const STANDARD_MIGRATIONS: Migration[] = [
  {
    id: '0001_initial_schema',
    name: 'Initial Core Schema (Users & Projects)',
    up: `
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Users Table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Projects Table
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Indexes for fast querying
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `,
    down: `
      DROP TABLE IF EXISTS projects;
      DROP TABLE IF EXISTS users;
    `,
  },
  {
    id: '0002_row_level_security',
    name: 'Row Level Security Policies',
    up: `
      -- Enable Row Level Security
      ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

      -- Allow users to manage only their own projects
      CREATE POLICY user_manage_own_projects ON projects
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    `,
    down: `
      DROP POLICY IF EXISTS user_manage_own_projects ON projects;
      ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
    `,
  },
]

export class MigrationManager {
  private applied = new Set<string>()

  getAvailableMigrations(): Migration[] {
    return [...STANDARD_MIGRATIONS]
  }

  isApplied(migrationId: string): boolean {
    return this.applied.has(migrationId)
  }

  markApplied(migrationId: string): void {
    this.applied.add(migrationId)
  }

  getAppliedMigrations(): string[] {
    return Array.from(this.applied)
  }

  clear(): void {
    this.applied.clear()
  }
}

export const sharedMigrationManager = new MigrationManager()
