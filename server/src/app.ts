import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool, Queryable } from './db';

const accessSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return secret;
};
const refreshCookie = 'refresh_token';
type Role = 'admin' | 'manager' | 'reader';
type UserClaims = { sub: string; email: string; role: Role };
type AuthRequest = Request & { user?: UserClaims };
const dateFields = [
  'date_first_legal_document', 'date_send_admin_signature', 'date_admin_signed_return',
  'date_send_client_signature', 'date_client_signed_return', 'date_send_registration',
  'date_registered_return', 'date_effective', 'date_archived',
] as const;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const makeAccessToken = (claims: UserClaims) => jwt.sign(claims, accessSecret(), { expiresIn: '15m' });

function authenticate(request: AuthRequest, response: Response, next: NextFunction) {
  const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({ error: 'Authentification requise' });
  try {
    request.user = jwt.verify(token, accessSecret()) as UserClaims;
    next();
  } catch {
    return response.status(401).json({ error: 'Jeton invalide ou expiré' });
  }
}

function requireRoles(...allowed: Role[]) {
  return (request: AuthRequest, response: Response, next: NextFunction) => {
    if (!request.user || !allowed.includes(request.user.role)) {
      return response.status(403).json({ error: 'Accès interdit' });
    }
    next();
  };
}

function derivedContractState(row: Record<string, unknown>) {
  if (row.date_archived) return 'archived';
  if (row.date_effective) return 'active';
  if (row.date_first_legal_document) return 'in_progress';
  return 'pending';
}

export function createApp(db: Queryable = pool) {
  const app = express();
  app.use(helmet());
  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));

  app.get('/api/health', (_request, response) => {
    const databaseConfigured = Boolean(process.env.DATABASE_URL);
    const jwtSecretConfigured = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);
    const ready = databaseConfigured && jwtSecretConfigured;
    return response.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'configuration_required',
      databaseConfigured,
      jwtSecretConfigured,
    });
  });

  app.post('/api/auth/login', async (request, response, next) => {
    try {
      if (!process.env.DATABASE_URL) {
        return response.status(503).json({ error: 'DATABASE_URL manquant dans le fichier .env.' });
      }
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        return response.status(503).json({ error: 'JWT_SECRET manquant ou trop court dans le fichier .env (32 caractères minimum).' });
      }
      const input = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: 'Identifiants invalides' });
      const result = await db.query('SELECT id, email, full_name, password_hash, role FROM app_users WHERE email = $1 AND is_active = TRUE', [input.data.email.toLowerCase()]);
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(input.data.password, user.password_hash))) {
        return response.status(401).json({ error: 'Identifiants incorrects' });
      }
      const claims: UserClaims = { sub: String(user.id), email: user.email, role: user.role };
      const refreshToken = randomUUID();
      await db.query('INSERT INTO refresh_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')', [user.id, hashToken(refreshToken)]);
      response.cookie(refreshCookie, refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000, path: '/api/auth' });
      return response.json({ accessToken: makeAccessToken(claims), user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/refresh', async (request, response, next) => {
    try {
      const token = request.cookies[refreshCookie];
      if (!token) return response.status(401).json({ error: 'Session absente' });
      const result = await db.query('SELECT u.id, u.email, u.role FROM refresh_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = TRUE', [hashToken(token)]);
      const user = result.rows[0];
      if (!user) return response.status(401).json({ error: 'Session expirée' });
      return response.json({ accessToken: makeAccessToken({ sub: String(user.id), email: user.email, role: user.role }) });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/logout', async (request, response, next) => {
    try {
      const token = request.cookies[refreshCookie];
      if (token) await db.query('DELETE FROM refresh_sessions WHERE token_hash = $1', [hashToken(token)]);
      response.clearCookie(refreshCookie, { httpOnly: true, sameSite: 'strict', path: '/api/auth' });
      return response.status(204).end();
    } catch (error) { next(error); }
  });

  app.get('/api/auth/me', authenticate, (request: AuthRequest, response) => response.json({ user: request.user }));

  app.get('/api/dashboard/stats', authenticate, async (_request, response, next) => {
    try {
      const [dossiers, contracts, expenses, procedures, overdue] = await Promise.all([
        db.query('SELECT status AS label, COUNT(*)::int AS value FROM dossiers GROUP BY status ORDER BY status'),
        db.query('SELECT state AS label, COUNT(*)::int AS value FROM contracts GROUP BY state ORDER BY state'),
        db.query("SELECT COALESCE(expense_nature, 'Non renseignée') AS label, COUNT(*)::int AS value FROM dossiers GROUP BY expense_nature ORDER BY label"),
        db.query('SELECT procedure_type AS label, COUNT(*)::int AS value FROM dossiers GROUP BY procedure_type ORDER BY procedure_type'),
        db.query("SELECT id, reference, subject, submission_deadline FROM dossiers WHERE submission_deadline < CURRENT_DATE AND status IN ('draft', 'published', 'evaluation') ORDER BY submission_deadline LIMIT 10"),
      ]);
      return response.json({ charts: { dossiersByStatus: dossiers.rows, contractsByState: contracts.rows, dossiersByExpenseNature: expenses.rows, dossiersByProcedure: procedures.rows }, alerts: { overdueCount: overdue.rowCount ?? overdue.rows.length, overdueDossiers: overdue.rows } });
    } catch (error) { next(error); }
  });

  const listRoute = (table: 'dossiers' | 'contracts', searchColumns: string[]) => async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), q: z.string().trim().max(100).optional(), status: z.string().trim().max(40).optional(), export: z.enum(['csv']).optional() }).safeParse(request.query);
      if (!parsed.success) return response.status(400).json({ error: 'Paramètres de recherche invalides' });
      const { page, pageSize, q, status } = parsed.data;
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (q) {
        values.push(`%${q}%`);
        conditions.push(`(${searchColumns.map((column) => `${column} ILIKE $${values.length}`).join(' OR ')})`);
      }
      const statusColumn = table === 'dossiers' ? 'status' : 'state';
      if (status) { values.push(status); conditions.push(`${statusColumn} = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM ${table} ${where}`, values);
      const total = Number(countResult.rows[0]?.total ?? 0);
      if (parsed.data.export === 'csv') {
        const result = await db.query(`SELECT * FROM ${table} ${where} ORDER BY id DESC LIMIT 5000`, values);
        const keys = result.rows.length ? Object.keys(result.rows[0]) : [];
        const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
        const csv = [keys.map(quote).join(','), ...result.rows.map((row) => keys.map((key) => quote(row[key])).join(','))].join('\r\n');
        response.setHeader('Content-Type', 'text/csv; charset=utf-8');
        response.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
        return response.send(`\uFEFF${csv}`);
      }
      values.push(pageSize, (page - 1) * pageSize);
      const result = await db.query(`SELECT * FROM ${table} ${where} ORDER BY id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
      return response.json({ data: result.rows, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
    } catch (error) { next(error); }
  };

  app.get('/api/dossiers', authenticate, listRoute('dossiers', ['reference', 'subject', 'owner_name']));
  app.get('/api/contracts', authenticate, listRoute('contracts', ['contract_number', 'subject', 'holder']));

  app.get('/api/dossiers/:id', authenticate, async (request, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant invalide' });
      const result = await db.query('SELECT * FROM dossiers WHERE id = $1', [id.data]);
      return result.rows[0] ? response.json({ data: result.rows[0] }) : response.status(404).json({ error: 'Dossier introuvable' });
    } catch (error) { next(error); }
  });

  app.patch('/api/contracts/:id/tracking', authenticate, requireRoles('admin', 'manager'), async (request, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      const input = z.object(Object.fromEntries(dateFields.map((field) => [field, z.string().date().nullable().optional()]))).strict().safeParse(request.body);
      if (!id.success || !input.success || Object.keys(input.data).length === 0) return response.status(400).json({ error: 'Identifiant ou dates invalides' });
      const fields = Object.keys(input.data) as (typeof dateFields)[number][];
      const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
      const values = fields.map((field) => input.data[field] ?? null);
      const sql = `UPDATE contracts SET ${assignments.join(', ')}, state = CASE WHEN date_archived IS NOT NULL THEN 'archived' WHEN date_effective IS NOT NULL THEN 'active' WHEN date_first_legal_document IS NOT NULL THEN 'in_progress' ELSE 'pending' END WHERE id = $1 RETURNING *`;
      const result = await db.query(sql, [id.data, ...values]);
      return result.rows[0] ? response.json({ data: result.rows[0], derivedState: derivedContractState(result.rows[0]) }) : response.status(404).json({ error: 'Contrat introuvable' });
    } catch (error) { next(error); }
  });

  app.get('/api/calendar/events', authenticate, async (request, response, next) => {
    try {
      const input = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).safeParse(request.query);
      if (!input.success) return response.status(400).json({ error: 'Période de calendrier invalide' });
      const result = await db.query(
        "SELECT id, reference AS title, submission_deadline AS event_date, 'dossier' AS kind FROM dossiers WHERE submission_deadline IS NOT NULL AND ($1::date IS NULL OR submission_deadline >= $1) AND ($2::date IS NULL OR submission_deadline <= $2) UNION ALL SELECT id, contract_number AS title, date_effective AS event_date, 'contract' AS kind FROM contracts WHERE date_effective IS NOT NULL AND ($1::date IS NULL OR date_effective >= $1) AND ($2::date IS NULL OR date_effective <= $2) ORDER BY event_date",
        [input.data.from ?? null, input.data.to ?? null],
      );
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/planning/annual', authenticate, async (request, response, next) => {
    try {
      const input = z.object({ year: z.coerce.number().int().min(2000).max(2200).default(new Date().getFullYear()), q: z.string().trim().max(100).optional() }).safeParse(request.query);
      if (!input.success) return response.status(400).json({ error: 'Année ou recherche invalide' });
      const result = await db.query('SELECT * FROM annual_programs WHERE fiscal_year = $1 AND ($2::text IS NULL OR reference ILIKE $2 OR subject ILIKE $2) ORDER BY estimated_start_date NULLS LAST, reference', [input.data.year, input.data.q ? `%${input.data.q}%` : null]);
      return response.json({ data: result.rows, year: input.data.year });
    } catch (error) { next(error); }
  });

  app.get('/api/planning/work-schedule', authenticate, async (request, response, next) => {
    try {
      const year = z.coerce.number().int().min(2000).max(2200).default(new Date().getFullYear()).safeParse(request.query.year);
      if (!year.success) return response.status(400).json({ error: 'Année invalide' });
      const result = await db.query('SELECT * FROM work_schedule WHERE fiscal_year = $1 ORDER BY start_date NULLS LAST, title', [year.data]);
      return response.json({ data: result.rows, year: year.data });
    } catch (error) { next(error); }
  });

  app.get('/api/reminders', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const result = await db.query('SELECT id, title, details, reminder_at, importance, lead_minutes, is_sent, created_at FROM user_reminders WHERE user_id = $1 ORDER BY reminder_at', [Number(request.user!.sub)]);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/reminders', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ title: z.string().trim().min(1).max(160), details: z.string().trim().max(2000).optional(), reminderAt: z.string().datetime(), importance: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'), leadMinutes: z.number().int().min(0).max(10080).default(0) }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: 'Rappel invalide' });
      const result = await db.query('INSERT INTO user_reminders (user_id, title, details, reminder_at, importance, lead_minutes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, details, reminder_at, importance, lead_minutes, is_sent', [Number(request.user!.sub), input.data.title, input.data.details ?? null, input.data.reminderAt, input.data.importance, input.data.leadMinutes]);
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.get('/api/overtime', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const isManager = ['admin', 'manager'].includes(request.user!.role);
      const result = await db.query(`SELECT id, employee_label, work_date, start_time, end_time, hours, comment, period FROM overtime_entries ${isManager ? '' : 'WHERE user_id = $1'} ORDER BY work_date DESC LIMIT 100`, isManager ? [] : [Number(request.user!.sub)]);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/leaves', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const isManager = ['admin', 'manager'].includes(request.user!.role);
      const result = await db.query(`SELECT id, employee_label, leave_type, start_date, end_date, requested_days, holidays, status, requested_at FROM leave_requests ${isManager ? '' : 'WHERE user_id = $1'} ORDER BY start_date DESC LIMIT 100`, isManager ? [] : [Number(request.user!.sub)]);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/audit', authenticate, requireRoles('admin', 'manager'), async (_request, response, next) => {
    try {
      const result = await db.query('SELECT id, entity_name, entity_id, action, summary, changed_at FROM audit_events ORDER BY changed_at DESC LIMIT 100');
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/users', authenticate, requireRoles('admin'), async (_request, response, next) => {
    try {
      const result = await db.query('SELECT id, email, full_name, role, is_active, created_at FROM app_users ORDER BY full_name');
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/clarifications', authenticate, async (request, response, next) => {
    try {
      const q = z.string().trim().max(100).optional().safeParse(request.query.q);
      if (!q.success) return response.status(400).json({ error: 'Recherche invalide' });
      const result = await db.query('SELECT c.id, d.reference AS dossier_reference, c.subject, c.received_at, c.response, c.sent_at FROM clarification_requests c JOIN dossiers d ON d.id = c.dossier_id WHERE $1::text IS NULL OR d.reference ILIKE $1 OR c.subject ILIKE $1 ORDER BY c.created_at DESC LIMIT 100', [q.data ? `%${q.data}%` : null]);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/clarifications', authenticate, requireRoles('admin', 'manager'), async (request, response, next) => {
    try {
      const input = z.object({ dossierId: z.number().int().positive(), subject: z.string().trim().min(1).max(500), receivedAt: z.string().date().nullable().optional(), response: z.string().trim().max(4000).optional(), sentAt: z.string().date().nullable().optional() }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: 'Demande de clarification invalide' });
      const result = await db.query('INSERT INTO clarification_requests (dossier_id, subject, received_at, response, sent_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, dossier_id, subject, received_at, response, sent_at', [input.data.dossierId, input.data.subject, input.data.receivedAt ?? null, input.data.response ?? null, input.data.sentAt ?? null]);
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.get('/api/notes', authenticate, async (_request, response, next) => {
    try {
      const result = await db.query('SELECT n.id, d.reference AS dossier_reference, n.body, u.full_name AS author, n.created_at FROM dossier_notes n JOIN dossiers d ON d.id = n.dossier_id LEFT JOIN app_users u ON u.id = n.author_id ORDER BY n.created_at DESC LIMIT 100');
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/notes', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ dossierId: z.number().int().positive(), body: z.string().trim().min(1).max(4000) }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: 'Remarque invalide' });
      const result = await db.query('INSERT INTO dossier_notes (dossier_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, dossier_id, body, created_at', [input.data.dossierId, Number(request.user!.sub), input.data.body]);
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.use((_error: unknown, _request: Request, response: Response, next: NextFunction) => {
    void next;
    if (!process.env.DATABASE_URL) {
      return response.status(503).json({ error: 'Base de données non configurée. Définissez DATABASE_URL puis exécutez npm run db:migrate et npm run seed.' });
    }
    return response.status(500).json({ error: 'Erreur interne' });
  });
  return app;
}
