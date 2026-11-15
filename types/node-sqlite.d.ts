declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    prepare(sql: string): { all(...params: number[]): unknown[] };
    close(): void;
  }
}
