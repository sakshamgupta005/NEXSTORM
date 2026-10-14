import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDatabaseConfig,
  maskDatabaseUrl,
  checkDatabaseHealth,
  InMemoryDatabaseAdapter,
  MigrationManager,
  STANDARD_MIGRATIONS,
} from '@/lib/database';
import {
  LocalStorageAdapter,
  sanitizeStoragePath,
  generateSafeStoragePath,
  validateStorageFile,
  verifyStorageAccess,
  SupabaseStorageAdapter,
  StoredFileMetadata,
} from '@/lib/storage';
import { InMemoryCache, RedisCacheAdapter } from '@/lib/cache';

interface TestUser extends Record<string, unknown> {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt?: string;
  updatedAt?: string;
}

describe('Database Abstraction Toolkit', () => {
  it('correctly masks database connection credentials', () => {
    const rawUrl = 'postgres://admin_user:super_secret_pw@db.region.supabase.co:5432/postgres';
    const masked = maskDatabaseUrl(rawUrl);
    expect(masked).toBe('postgres://admin_user:******@db.region.supabase.co:5432/postgres');
    expect(masked).not.toContain('super_secret_pw');
  });

  it('evaluates database configuration and missing environment safely', () => {
    const config = getDatabaseConfig();
    expect(config.database).toBeDefined();
    expect(config.maxConnections).toBeGreaterThan(0);
    expect(config.connectionTimeoutMs).toBe(3000);
  });

  it('performs non-blocking health check on database adapter', async () => {
    const health = await checkDatabaseHealth();
    expect(health.status).toBe('healthy');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.provider).toBe('in-memory');

    const db = new InMemoryDatabaseAdapter();
    const adapterHealth = await db.checkHealth();
    expect(adapterHealth.status).toBe('healthy');
    expect(adapterHealth.provider).toBe('in-memory');
  });

  it('supports repository CRUD operations with filtering, sorting, and pagination', async () => {
    const db = new InMemoryDatabaseAdapter();
    const userRepo = db.getRepository<TestUser>('users');

    // Create
    const user1 = await userRepo.create({
      id: 'u1',
      email: 'alice@example.com',
      name: 'Alice Cooper',
      role: 'admin',
    });
    await userRepo.create({
      id: 'u2',
      email: 'bob@example.com',
      name: 'Bob Marley',
      role: 'user',
    });
    await userRepo.create({
      id: 'u3',
      email: 'charlie@example.com',
      name: 'Charlie Day',
      role: 'user',
    });

    expect(user1.id).toBe('u1');
    expect(user1.createdAt).toBeDefined();

    // FindById
    const found = await userRepo.findById('u1');
    expect(found?.email).toBe('alice@example.com');

    // Find with filter and sorting
    const users = await userRepo.find(
      { role: 'user' },
      { sortBy: 'name', sortOrder: 'asc' }
    );
    expect(users.length).toBe(2);
    expect(users[0].name).toBe('Bob Marley');
    expect(users[1].name).toBe('Charlie Day');

    // Pagination
    const page = await userRepo.find(
      undefined,
      { sortBy: 'name', sortOrder: 'asc', limit: 1, offset: 1 }
    );
    expect(page.length).toBe(1);
    expect(page[0].name).toBe('Bob Marley');

    // Update
    const updated = await userRepo.update('u2', { name: 'Robert Marley' });
    expect(updated?.name).toBe('Robert Marley');

    // Count
    const count = await userRepo.count({ role: 'user' });
    expect(count).toBe(2);

    // Delete
    const deleted = await userRepo.delete('u3');
    expect(deleted).toBe(true);
    expect(await userRepo.count()).toBe(2);
  });

  it('handles atomic transactions with successful commit and rollback on failure', async () => {
    const db = new InMemoryDatabaseAdapter();
    const userRepo = db.getRepository<TestUser>('users');

    await userRepo.create({
      id: 'u10',
      email: 'init@test.com',
      name: 'Initial',
      role: 'user',
    });

    // Successful transaction
    await db.transaction(async (tx) => {
      const txRepo = tx.getRepository<TestUser>('users');
      await txRepo.create({
        id: 'u11',
        email: 'tx@test.com',
        name: 'Transacted',
        role: 'user',
      });
    });
    expect(await userRepo.findById('u11')).toBeDefined();

    // Failing transaction with rollback
    await expect(
      db.transaction(async (tx) => {
        const txRepo = tx.getRepository<TestUser>('users');
        await txRepo.create({
          id: 'u12',
          email: 'rollback@test.com',
          name: 'Should Rollback',
          role: 'user',
        });
        throw new Error('Simulated failure during checkout/save');
      })
    ).rejects.toThrow('Simulated failure during checkout/save');

    expect(await userRepo.findById('u12')).toBeNull();
  });

  it('tracks schema migration templates and applied state in migration manager', () => {
    const manager = new MigrationManager();
    const available = manager.getAvailableMigrations();
    expect(available.length).toBeGreaterThanOrEqual(2);
    expect(available[0].id).toBe('0001_initial_schema');

    expect(manager.isApplied('0001_initial_schema')).toBe(false);
    manager.markApplied('0001_initial_schema');
    expect(manager.isApplied('0001_initial_schema')).toBe(true);
    expect(manager.getAppliedMigrations()).toEqual(['0001_initial_schema']);

    manager.clear();
    expect(manager.getAppliedMigrations().length).toBe(0);
    expect(STANDARD_MIGRATIONS[0].up).toContain('CREATE TABLE IF NOT EXISTS users');
  });
});

describe('File Storage Toolkit & Security', () => {
  let storage: LocalStorageAdapter;

  beforeEach(() => {
    storage = new LocalStorageAdapter();
  });

  it('blocks path traversal and sanitizes invalid file paths', () => {
    const res1 = sanitizeStoragePath('../../../etc/passwd');
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain('Path traversal');

    const res2 = sanitizeStoragePath('uploads/..\\secret.key');
    expect(res2.valid).toBe(false);

    const res3 = sanitizeStoragePath('uploads/\0evil.txt');
    expect(res3.valid).toBe(false);

    const res4 = sanitizeStoragePath('C:/absolute/path/file.txt');
    expect(res4.valid).toBe(false);

    const validRes = sanitizeStoragePath('uploads/user_123/profile picture.png');
    expect(validRes.valid).toBe(true);
    expect(validRes.path).toBe('uploads/user_123/profile picture.png');
  });

  it('generates safe, unique, collision-resistant storage paths', () => {
    const safePath = generateSafeStoragePath('My Resume 2026.pdf', 'avatars');
    expect(safePath.startsWith('avatars/')).toBe(true);
    expect(safePath.endsWith('.pdf')).toBe(true);
    expect(safePath).not.toContain(' ');
  });

  it('validates file size caps and blocks dangerous executable file formats', () => {
    // Valid file
    const valid = validateStorageFile('document.pdf', 500 * 1024, 'application/pdf');
    expect(valid.valid).toBe(true);

    // Over size limit
    const oversized = validateStorageFile(
      'huge.mp4',
      50 * 1024 * 1024,
      'video/mp4',
      { maxSizeInBytes: 10 * 1024 * 1024 }
    );
    expect(oversized.valid).toBe(false);
    expect(oversized.error).toContain('exceeds limit');

    // Dangerous extension
    const dangerous = validateStorageFile('exploit.sh', 100, 'text/plain');
    expect(dangerous.valid).toBe(false);
    expect(dangerous.error).toContain('Executable or script');
  });

  it('enforces file authorization boundaries for public and private assets', () => {
    const publicFile: StoredFileMetadata = {
      id: 'f1',
      name: 'doc.pdf',
      path: 'public/doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      isPublic: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: 'user_1',
    };

    const privateFile: StoredFileMetadata = {
      id: 'f2',
      name: 'private.pdf',
      path: 'private/private.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: 'user_1',
    };

    // Anyone can read public files
    expect(verifyStorageAccess(publicFile)).toBe(true);

    // Anonymous cannot read private files
    expect(verifyStorageAccess(privateFile)).toBe(false);

    // Owner can read private files
    expect(verifyStorageAccess(privateFile, 'user_1', 'user')).toBe(true);

    // Non-owner cannot read private files
    expect(verifyStorageAccess(privateFile, 'user_2', 'user')).toBe(false);

    // Admin can read private files
    expect(verifyStorageAccess(privateFile, 'admin_1', 'admin')).toBe(true);
  });

  it('uploads, retrieves, checks existence, and deletes files in LocalStorageAdapter', async () => {
    const content = Buffer.from('Hello Hackathon Storage');
    const uploadRes = await storage.upload(content, 'readme.txt', {
      path: 'documents/readme.txt',
      ownerId: 'usr_abc',
      isPublic: false,
    });

    expect(uploadRes.success).toBe(true);
    expect(uploadRes.file?.path).toBe('documents/readme.txt');
    expect(uploadRes.file?.sizeBytes).toBe(content.length);

    // Existence
    expect(await storage.exists('documents/readme.txt')).toBe(true);
    expect(await storage.exists('documents/nonexistent.txt')).toBe(false);

    // Retrieval
    const downloaded = await storage.download('documents/readme.txt');
    expect(downloaded.success).toBe(true);
    expect(downloaded.data?.toString('utf-8')).toBe('Hello Hackathon Storage');
    expect(downloaded.metadata?.ownerId).toBe('usr_abc');

    // List
    const files = await storage.list('documents');
    expect(files.length).toBe(1);
    expect(files[0].name).toBe('readme.txt');

    // Signed URL
    const signedUrl = await storage.getSignedUrl('documents/readme.txt', { expiresInSeconds: 60 });
    expect(signedUrl).toContain('expires=');
    expect(signedUrl).toContain('sig=');

    // Delete
    const deleteRes = await storage.delete('documents/readme.txt');
    expect(deleteRes.success).toBe(true);
    expect(await storage.exists('documents/readme.txt')).toBe(false);
  });

  it('gracefully handles missing Supabase credentials in SupabaseStorageAdapter', async () => {
    const supabaseStorage = new SupabaseStorageAdapter('test-bucket');
    const content = Buffer.from('test');

    // Should fall back gracefully to local adapter without crashing
    const res = await supabaseStorage.upload(content, 'test.txt', { path: 'test.txt' });
    expect(res.success).toBe(true);
    expect(res.file?.name).toBe('test.txt');
    expect(await supabaseStorage.exists(res.file!.path)).toBe(true);
  });
});

describe('Caching Layer Toolkit', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  it('performs basic get, set, delete, and clear operations', async () => {
    await cache.set('key1', 'value1');
    expect(await cache.get('key1')).toBe('value1');
    expect(await cache.has('key1')).toBe(true);

    const deleted = await cache.delete('key1');
    expect(deleted).toBe(true);
    expect(await cache.get('key1')).toBeNull();
    expect(await cache.has('key1')).toBe(false);

    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.clear();
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBeNull();
  });

  it('evaporates expired keys according to TTL', async () => {
    // 0.05 second TTL
    await cache.set('tempKey', 'expiring', 0.05);
    expect(await cache.get('tempKey')).toBe('expiring');

    // Wait 70ms
    await new Promise((resolve) => setTimeout(resolve, 70));

    expect(await cache.get('tempKey')).toBeNull();
    expect(await cache.has('tempKey')).toBe(false);
  });

  it('isolates cache keys with namespacing', async () => {
    const projectCache = cache.namespace('projects');
    const userCache = cache.namespace('users');

    await projectCache.set('1', { name: 'Hackathon Starter' });
    await userCache.set('1', { name: 'Alice' });

    const p = await projectCache.get<{ name: string }>('1');
    const u = await userCache.get<{ name: string }>('1');

    expect(p?.name).toBe('Hackathon Starter');
    expect(u?.name).toBe('Alice');
  });

  it('safely memoizes computation with resilient getOrSet fallback', async () => {
    let callCount = 0;
    const fetchExpensiveData = async () => {
      callCount++;
      return { report: 'AI Analysis', count: 42 };
    };

    const first = await cache.getOrSet('analysis_report', fetchExpensiveData, 60);
    expect(first.report).toBe('AI Analysis');
    expect(callCount).toBe(1);

    // Second call should come from cache without invoking factory
    const second = await cache.getOrSet('analysis_report', fetchExpensiveData, 60);
    expect(second.count).toBe(42);
    expect(callCount).toBe(1);
  });

  it('tracks cache hits, misses, and keys count statistics', async () => {
    await cache.set('k1', 'val');
    await cache.get('k1'); // hit
    await cache.get('k2'); // miss

    const stats = await cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.keysCount).toBe(1);
  });

  it('RedisCacheAdapter operates safely and falls back without throwing when unconfigured', async () => {
    const redis = new RedisCacheAdapter(); // unconfigured
    await redis.set('cached_val', { flag: true });
    const val = await redis.get<{ flag: boolean }>('cached_val');
    expect(val?.flag).toBe(true);

    const exists = await redis.has('cached_val');
    expect(exists).toBe(true);

    await redis.delete('cached_val');
    expect(await redis.has('cached_val')).toBe(false);
  });
});
