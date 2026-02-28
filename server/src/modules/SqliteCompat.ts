import BetterSqlite3 from "better-sqlite3";

type RunCallback = (
  this: { lastID?: number; changes?: number },
  ...args: any[]
) => void;

type ExecCallback = (error: Error | null) => void;

type RowCallback = (...args: any[]) => void;

function executeStatement<T>(
  statement: BetterSqlite3.Statement,
  method: "run" | "get" | "all",
  params: unknown[] | Record<string, unknown> | unknown | undefined
): T {
  if (params === undefined) {
    return statement[method]() as T;
  }

  if (Array.isArray(params)) {
    return statement[method](...params) as T;
  }

  if (typeof params === "object" && params !== null) {
    return statement[method](params as Record<string, unknown>) as T;
  }

  return statement[method](params) as T;
}

export class Database {
  private db: BetterSqlite3.Database;

  constructor(filename: string, callback?: ExecCallback) {
    this.db = new BetterSqlite3(filename);
    if (callback) {
      setImmediate(() => callback(null));
    }
  }

  exec(sql: string, callback?: ExecCallback): this {
    try {
      this.db.exec(sql);
      callback?.(null);
    } catch (error) {
      callback?.(error as Error);
    }

    return this;
  }

  run(sql: string, callback?: RunCallback): this;
  run(
    sql: string,
    params: unknown[] | Record<string, unknown> | unknown,
    callback?: RunCallback
  ): this;
  run(
    sql: string,
    paramsOrCallback?:
      | unknown[]
      | Record<string, unknown>
      | unknown
      | RunCallback,
    callback?: RunCallback
  ): this {
    const params =
      typeof paramsOrCallback === "function" ? undefined : paramsOrCallback;
    const onComplete =
      typeof paramsOrCallback === "function" ? paramsOrCallback : callback;

    try {
      const statement = this.db.prepare(sql);
      const result = executeStatement<BetterSqlite3.RunResult>(
        statement,
        "run",
        params
      );

      const lastID = Number(result.lastInsertRowid);
      onComplete?.call(
        { lastID, changes: result.changes },
        null,
        Number.isNaN(lastID) ? undefined : lastID
      );
    } catch (error) {
      onComplete?.call({}, error as Error);
    }

    return this;
  }

  get(sql: string, callback: RowCallback): this;
  get(
    sql: string,
    params: unknown[] | Record<string, unknown> | unknown,
    callback: RowCallback
  ): this;
  get(
    sql: string,
    paramsOrCallback:
      | unknown[]
      | Record<string, unknown>
      | unknown
      | RowCallback,
    callback?: RowCallback
  ): this {
    const params =
      typeof paramsOrCallback === "function" ? undefined : paramsOrCallback;
    const onComplete =
      typeof paramsOrCallback === "function" ? paramsOrCallback : callback;

    try {
      const statement = this.db.prepare(sql);
      const row = executeStatement<unknown>(statement, "get", params);
      onComplete?.(null, row);
    } catch (error) {
      onComplete?.(error as Error);
    }

    return this;
  }

  all(sql: string, callback: RowCallback): this;
  all(
    sql: string,
    params: unknown[] | Record<string, unknown> | unknown,
    callback: RowCallback
  ): this;
  all(
    sql: string,
    paramsOrCallback:
      | unknown[]
      | Record<string, unknown>
      | unknown
      | RowCallback,
    callback?: RowCallback
  ): this {
    const params =
      typeof paramsOrCallback === "function" ? undefined : paramsOrCallback;
    const onComplete =
      typeof paramsOrCallback === "function" ? paramsOrCallback : callback;

    try {
      const statement = this.db.prepare(sql);
      const rows = executeStatement<unknown[]>(statement, "all", params) ?? [];
      onComplete?.(null, rows);
    } catch (error) {
      onComplete?.(error as Error);
    }

    return this;
  }

  serialize(callback: () => void): this {
    callback();
    return this;
  }

  close(callback?: ExecCallback): this {
    try {
      this.db.close();
      callback?.(null);
    } catch (error) {
      callback?.(error as Error);
    }

    return this;
  }
}
