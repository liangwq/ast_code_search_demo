import SQLite3 from 'sqlite3';

export class Database {
  private db: SQLite3.Database;
  private static instance: Database;

  private constructor(dbPath: string = 'code_snippets.db') {
    this.db = new SQLite3.Database(dbPath);
  }

  public static getInstance(dbPath?: string): Database {
    if (!Database.instance) {
      Database.instance = new Database(dbPath);
    }
    return Database.instance;
  }

  public getDb(): SQLite3.Database {
    return this.db;
  }

  public async run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  public async get<T>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T || null);
      });
    });
  }

  public async prepare(sql: string): Promise<SQLite3.Statement> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(sql, (err) => {
        if (err) reject(err);
        else resolve(stmt);
      });
    });
  }

  public async beginTransaction(): Promise<void> {
    return this.run('BEGIN TRANSACTION');
  }

  public async commitTransaction(): Promise<void> {
    return this.run('COMMIT');
  }

  public async rollbackTransaction(): Promise<void> {
    return this.run('ROLLBACK');
  }

  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}