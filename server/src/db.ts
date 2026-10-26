import { Pool, types } from 'pg';

types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => value);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export type Queryable = Pick<Pool, 'query'>;
