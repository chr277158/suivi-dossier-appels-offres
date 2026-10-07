import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app';
import { Queryable } from '../src/db';

const demoUser = { id: 7, email: 'admin@gct.tn', full_name: 'Admin Demo', password_hash: bcrypt.hashSync('Admin123!', 4), role: 'admin' };
function fakeDb() {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM app_users WHERE email')) return { rows: [demoUser], rowCount: 1 } as never;
    if (sql.includes('INSERT INTO refresh_sessions')) return { rows: [], rowCount: 1 } as never;
    if (sql.includes('COUNT(*)::int AS total FROM dossiers')) return { rows: [{ total: 1 }], rowCount: 1 } as never;
    if (sql.includes('SELECT * FROM dossiers') && sql.includes('ORDER BY id DESC')) return { rows: [{ id: 3, reference: 'AO-TEST-03', subject: 'Essai pagination', status: 'published' }], rowCount: 1 } as never;
    if (sql.includes("GROUP BY status ORDER BY status")) return { rows: [{ label: 'published', value: 2 }], rowCount: 1 } as never;
    if (sql.includes("GROUP BY state ORDER BY state")) return { rows: [{ label: 'active', value: 1 }], rowCount: 1 } as never;
    if (sql.includes('GROUP BY expense_nature')) return { rows: [{ label: 'Services', value: 2 }], rowCount: 1 } as never;
    if (sql.includes('GROUP BY procedure_type')) return { rows: [{ label: 'Consultation', value: 1 }], rowCount: 1 } as never;
    if (sql.includes('submission_deadline < CURRENT_DATE')) return { rows: [{ id: 3, reference: 'AO-TEST-03' }], rowCount: 1 } as never;
    return { rows: [], rowCount: 0 } as never;
  });
  return { query };
}

describe('API migration baseline', () => {
  const db = fakeDb();
  const app = createApp(db as unknown as Queryable);
  let token = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://unit-test:unit-test@localhost:5432/unit-test';
    process.env.JWT_SECRET = 'unit-test-secret-at-least-32-characters';
    const response = await request(app).post('/api/auth/login').send({ email: demoUser.email, password: 'Admin123!' });
    expect(response.status).toBe(200);
    token = response.body.accessToken;
  });

  it('authenticates users and returns a role-bearing access token', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ email: demoUser.email, role: 'admin' });
  });

  it('rejects protected routes without a token', async () => {
    const response = await request(app).get('/api/dashboard/stats');
    expect(response.status).toBe(401);
  });

  it('returns four dashboard chart series and overdue alerts', async () => {
    const response = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.charts)).toHaveLength(4);
    expect(response.body.alerts.overdueCount).toBe(1);
  });

  it('returns a paginated AO list and constrains page size', async () => {
    const response = await request(app).get('/api/dossiers?page=1&pageSize=10&q=essai').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data[0].reference).toBe('AO-TEST-03');
    expect(response.body.pagination).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ILIKE $1'), expect.arrayContaining(['%essai%']));
  });

  it('rejects malformed pagination instead of trusting query input', async () => {
    const response = await request(app).get('/api/dossiers?pageSize=1000').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });

  it('explains when the JWT secret is missing instead of returning an internal error', async () => {
    const secret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    const response = await request(app).post('/api/auth/login').send({ email: demoUser.email, password: 'Admin123!' });
    process.env.JWT_SECRET = secret;
    expect(response.status).toBe(503);
    expect(response.body.error).toContain('JWT_SECRET');
  });

  it('serves the annual planning view to authenticated users', async () => {
    const response = await request(app).get('/api/planning/annual?year=2026').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.year).toBe(2026);
    expect(response.body.data).toEqual([]);
  });

  it('never selects password fields for the account directory', async () => {
    const response = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, email, full_name, role, is_active, created_at'));
    expect(response.text).not.toContain('password_hash');
  });

  it('creates a clarification request only through the validated API contract', async () => {
    const response = await request(app).post('/api/clarifications').set('Authorization', `Bearer ${token}`).send({ dossierId: 1, subject: 'Précision sur le délai' });
    expect(response.status).toBe(201);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO clarification_requests'), [1, 'Précision sur le délai', null, null, null]);
  });

  it('creates a dossier remark for the authenticated user', async () => {
    const response = await request(app).post('/api/notes').set('Authorization', `Bearer ${token}`).send({ dossierId: 1, body: 'Pièce reçue pour examen.' });
    expect(response.status).toBe(201);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO dossier_notes'), [1, 7, 'Pièce reçue pour examen.']);
  });
});
