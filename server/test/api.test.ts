import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { types } from 'pg';
import request from 'supertest';
import webpush from 'web-push';
import { createApp } from '../src/app';
import { Queryable } from '../src/db';
import { defaultReferenceRules } from '../src/reference-rules';

const demoUser = { id: 7, email: 'admin@gct.tn', full_name: 'Admin Demo', password_hash: bcrypt.hashSync('Admin123!', 4), role: 'admin', matricule: 'GCT-ADMIN' };
function fakeDb() {
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('FROM app_users WHERE is_active')) return { rows: [demoUser], rowCount: 1 } as never;
    if (sql.includes('FROM app_users WHERE id = $1 AND is_active = TRUE')) return { rows: Number(params?.[0]) === demoUser.id ? [demoUser] : [], rowCount: Number(params?.[0]) === demoUser.id ? 1 : 0 } as never;
    if (sql.includes('FROM dossiers d LEFT JOIN app_users')) return { rows: [{ owner_name: 'Admin Demo', owner_full_name: 'Admin Demo', owner_email: demoUser.email }], rowCount: 1 } as never;
    if (sql.includes("WHERE role = 'admin' AND is_active = TRUE")) return { rows: [{ full_name: 'Admin Demo', email: demoUser.email }], rowCount: 1 } as never;
    if (sql.includes('FROM application_settings WHERE setting_key = $1')) return { rows: [{ setting_value: defaultReferenceRules }], rowCount: 1 } as never;
    if (sql.includes('FROM refresh_sessions s JOIN app_users')) return { rows: [demoUser], rowCount: 1 } as never;
    if (sql.includes('INSERT INTO refresh_sessions')) return { rows: [], rowCount: 1 } as never;
    if (sql.includes('SELECT CURRENT_DATE::text AS today')) return { rows: [{ today: '2026-10-20' }], rowCount: 1 } as never;
    if (sql.includes('COALESCE(BOOL_OR(s.step_key')) return { rows: [{
      id: 3, reference: 'AO-TEST-03', subject: 'Essai', status: 'published', owner_user_id: 7,
      announcement_date: '2026-10-22', bid_opening_date: null, committee_decision_date: null,
      offers_evaluated: false, provisional_bond_returned: false, definitive_bond_requested: false, contract_prepared: false,
    }], rowCount: 1 } as never;
    if (sql.includes('SELECT r.id, r.title, r.details, r.reminder_at')) return { rows: [{
      id: 31, title: 'Rappel personnel', details: 'À vérifier', reminder_at: '2026-10-20T09:00:00.000Z',
      importance: 'normal', lead_minutes: 0, is_sent: false, is_read: false, dossier_id: null,
      visible_until: null, delivery_status: 'pending', delivery_attempts: 0, has_push_subscription: false,
      dossier_reference: null, dossier_status: null, created_at: '2026-10-19T09:00:00.000Z', created_by_user_id: 7,
    }], rowCount: 1 } as never;
    if (sql.includes('SELECT 1 FROM configurable_options')) return { rows: [{ '?column?': 1 }], rowCount: 1 } as never;
    if (sql.includes('FROM configurable_options')) return { rows: [], rowCount: 0 } as never;
    if (sql.includes('SELECT id FROM app_users WHERE id = ANY')) return { rows: (params?.[0] as number[]).map((id) => ({ id })), rowCount: (params?.[0] as number[]).length } as never;
    if (sql.includes('INSERT INTO user_reminders')) return { rows: [{ id: 31, user_id: params?.[0], visible_until: params?.[7] }], rowCount: 1 } as never;
    if (sql.includes('FROM audit_events a')) return { rows: [{ id: 1, old_values: { id: '3', status: 'evaluation', unchanged: 'same' }, new_values: { id: '3', status: 'awarded', unchanged: 'same' } }], rowCount: 1 } as never;
    if (sql.includes('FROM dossiers WHERE submission_deadline >= LOCALTIMESTAMP')) return { rows: [{ id: 3, reference: 'AO-TEST-03', submission_deadline: '2026-10-20 10:30:00' }], rowCount: 1 } as never;
    if (sql.includes('UPDATE user_reminders SET is_read = TRUE')) return { rows: [{ id: params?.[0] ?? 31 }], rowCount: 1 } as never;
    if (sql.includes('COUNT(*)::int AS total FROM dossiers')) return { rows: [{ total: 1 }], rowCount: 1 } as never;
    if (sql.includes('SELECT * FROM dossiers') && sql.includes('ORDER BY id DESC')) return { rows: [{ id: 3, reference: 'AO-TEST-03', subject: 'Essai pagination', status: 'published' }], rowCount: 1 } as never;
    if (sql.includes("GROUP BY status ORDER BY status")) return { rows: [{ label: 'published', value: 2 }], rowCount: 1 } as never;
    if (sql.includes("GROUP BY state ORDER BY state")) return { rows: [{ label: 'active', value: 1 }], rowCount: 1 } as never;
    if (sql.includes('GROUP BY expense_nature')) return { rows: [{ label: 'Services', value: 2 }], rowCount: 1 } as never;
    if (sql.includes('GROUP BY procedure_type')) return { rows: [{ label: 'Consultation', value: 1 }], rowCount: 1 } as never;
    if (sql.includes('submission_deadline < LOCALTIMESTAMP')) return { rows: [{ id: 3, reference: 'AO-TEST-03' }], rowCount: 1 } as never;
    if (sql.includes('FROM dossiers WHERE status = $1')) return { rows: [{ id: 3, reference: 'AO-TEST-03', subject: 'Dossier filtré', status: 'published' }], rowCount: 1 } as never;
    if (sql.startsWith('SELECT id FROM dossiers WHERE id = $1')) return { rows: [{ id: params?.[0] }], rowCount: 1 } as never;
    if (sql.includes('WITH defined_steps')) return { rows: (params ?? []).slice(0, -1).map((step_key) => ({ step_key, completed_at: null })), rowCount: (params?.length ?? 1) - 1 } as never;
    if (sql.includes('INSERT INTO contracts')) return { rows: [{ id: 9, dossier_id: params?.[0], contract_number: params?.[1], subject: params?.[2], holder: params?.[3], amount: params?.[4], currency: params?.[5], state: params?.[6] }], rowCount: 1 } as never;
    if (sql.includes('INSERT INTO annual_programs')) return { rows: [{ id: 1, ...Object.fromEntries((params ?? []).map((value, index) => [index, value])) }], rowCount: 1 } as never;
    if (sql.includes('FROM contracts c LEFT JOIN dossiers')) return { rows: [{ id: 8, dossier_id: 3, contract_number: 'BC-2026-008', subject: 'Contrat test', state: 'active' }], rowCount: 1 } as never;
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
    const response = await request(app).post('/api/auth/login').send({ identifier: demoUser.email, password: 'Admin123!' });
    expect(response.status).toBe(200);
    token = response.body.accessToken;
  });

  it('keeps PostgreSQL DATE values as calendar-date strings', () => {
    expect(types.getTypeParser(1082)('2026-03-03')).toBe('2026-03-03');
  });

  it('authenticates users and returns a role-bearing access token', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ email: demoUser.email, role: 'admin' });
  });

  it('authenticates with the matricule regardless of letter case', async () => {
    const response = await request(app).post('/api/auth/login').send({ identifier: 'gct-admin', password: 'Admin123!' });
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: demoUser.id, role: 'admin' });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LOWER(matricule) = LOWER($1)'), ['gct-admin']);
  });

  it('restores a user and access token from the refresh cookie', async () => {
    const login = await request(app).post('/api/auth/login').send({ identifier: demoUser.email, password: 'Admin123!' });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const response = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user).toMatchObject({ id: demoUser.id, email: demoUser.email, fullName: demoUser.full_name });
  });

  it('rejects protected routes without a token', async () => {
    const response = await request(app).get('/api/dashboard/stats');
    expect(response.status).toBe(401);
  });

  it('combines stored manual reminders with dynamically calculated dossier notifications', async () => {
    const response = await request(app).get('/api/reminders').set({ Authorization: ['Bearer', token].join(' ') });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 31, type: 'manual', title: 'Rappel personnel' }),
      expect.objectContaining({
        id: 'business:publication:3',
        type: 'business',
        rule_key: 'publication',
        dossier_id: 3,
        reminder_at: '2026-10-20T00:00:00',
      }),
    ]));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN dossier_tracking_steps'), [true, 7]);
    expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_reminders'));
  });

  it('removes companion and automated workflow endpoints', async () => {
    const companion = await request(app).get('/api/reminders/companion-check').set({ Authorization: ['Bearer', token].join(' ') });
    const decision = await request(app).post('/api/reminders/31/decision').set({ Authorization: ['Bearer', token].join(' ') });
    const snooze = await request(app).post('/api/reminders/31/snooze').set({ Authorization: ['Bearer', token].join(' ') });
    expect(companion.status).toBe(404);
    expect(decision.status).toBe(404);
    expect(snooze.status).toBe(404);
  });

  it('returns four dashboard chart series and overdue alerts', async () => {
    const response = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.charts)).toHaveLength(4);
    expect(response.body.alerts.overdueCount).toBe(1);
  });

  it('lists upcoming dossier deadlines for managers and admins', async () => {
    const response = await request(app).get('/api/dashboard/deadlines').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ reference: 'AO-TEST-03', submission_deadline: '2026-10-20 10:30:00' });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('submission_deadline < CURRENT_DATE + 15'));
  });

  it('denies readers access to the global deadlines dashboard', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app).get('/api/dashboard/deadlines').set('Authorization', `Bearer ${readerToken}`);
    expect(response.status).toBe(403);
  });

  it('rejects malformed reader update payloads before database access', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app).patch('/api/dossiers/3').set('Authorization', `Bearer ${readerToken}`).send({});
    expect(response.status).toBe(400);
  });

  it('does not allow a reader to update another user’s dossier', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app).patch('/api/dossiers/3')
      .set('Authorization', ['Bearer', readerToken].join(' '))
      .send({
        reference: 'AG.26.3.0001', subject: 'Dossier', estimated_cost: 1000, estimated_currency: 'TND',
        provisional_bond_amount: null, launch_specification_reference: null, request_type: 'Étude',
        expense_nature: null, procedure_type: null, committee: 'CRA', owner_name: 'Un autre responsable',
        owner_user_id: 7, status: 'draft', status_manually_set: false, is_urgent: false, via_tuneps: false,
        announcement_date: null, submission_deadline: null, bid_opening_date: null, committee_decision_date: null,
        specification_approval_date: null, evaluation_report_date: null, contract_notification_date: null,
        results_publication_date: null, provisional_bond_return_date: null, definitive_bond_request_date: null,
        contract_preparation_date: null,
      });
    expect(response.status).toBe(404);
  });

  it('rejects dossier amounts that exceed the database precision', async () => {
    const response = await request(app).post('/api/dossiers').set('Authorization', `Bearer ${token}`).send({
      reference: 'AO-AMOUNT-01',
      subject: 'Test budget bounds',
      estimated_cost: 100_000_000_000,
      estimated_currency: 'TND',
      provisional_bond_amount: null,
      launch_specification_reference: null,
      request_type: null,
      expense_nature: null,
      procedure_type: null,
      committee: null,
      owner_name: null,
      owner_user_id: null,
      status: 'draft',
      status_manually_set: false,
      confirm_status_override: false,
      announcement_date: null,
      submission_deadline: null,
      bid_opening_date: null,
      committee_decision_date: null,
      specification_approval_date: null,
      evaluation_report_date: null,
      contract_notification_date: null,
      results_publication_date: null,
      provisional_bond_return_date: null,
      definitive_bond_request_date: null,
      contract_preparation_date: null,
    });
    expect(response.status).toBe(400);
  });

  it('rejects a dossier calendar whose evaluation report follows the committee decision', async () => {
    const response = await request(app).post('/api/dossiers').set('Authorization', `Bearer ${token}`).send({
      reference: 'AO-DATES-01',
      subject: 'Test date ordering',
      estimated_cost: null,
      estimated_currency: 'TND',
      provisional_bond_amount: null,
      launch_specification_reference: null,
      request_type: null,
      expense_nature: null,
      procedure_type: null,
      committee: null,
      owner_name: null,
      owner_user_id: null,
      status: 'draft',
      status_manually_set: false,
      confirm_status_override: false,
      announcement_date: '2026-10-02',
      submission_deadline: '2026-10-10T10:00',
      bid_opening_date: '2026-10-10T10:30',
      committee_decision_date: '2026-10-15',
      specification_approval_date: '2026-10-01',
      evaluation_report_date: '2026-10-16',
      contract_notification_date: null,
      results_publication_date: null,
      provisional_bond_return_date: null,
      definitive_bond_request_date: null,
      contract_preparation_date: null,
    });
    expect(response.status).toBe(400);
  });

  it('marks reminders as read only for their owner', async () => {
    const response = await request(app).post('/api/reminders/31/read').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(204);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1 AND user_id = $2'), [31, 7]);
  });

  it('marks all of the authenticated user reminders as read', async () => {
    const response = await request(app).post('/api/reminders/read-all').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(204);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1 AND is_read = FALSE'), [7]);
  });

  it('returns push availability for the authenticated user', async () => {
    const response = await request(app).get('/api/notifications/push').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ publicKey: null });
  });

  it('saves a valid push subscription for the authenticated user', async () => {
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/subscription/1',
      expirationTime: null,
      keys: { p256dh: 'public-key', auth: 'auth-key' },
    };
    const response = await request(app).post('/api/notifications/push')
      .set('Authorization', `Bearer ${token}`)
      .send(subscription);
    expect(response.status).toBe(204);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO push_subscriptions'), [7, subscription.endpoint, 'public-key', 'auth-key']);
  });

  it('rejects push subscriptions that do not use HTTPS', async () => {
    const response = await request(app).post('/api/notifications/push')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'http://push.example.com/subscription/1', keys: { p256dh: 'public-key', auth: 'auth-key' } });
    expect(response.status).toBe(400);
  });

  it('rejects push endpoints outside trusted browser push services', async () => {
    const response = await request(app).post('/api/notifications/push')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://internal.example.com/metadata', keys: { p256dh: 'public-key', auth: 'auth-key' } });
    expect(response.status).toBe(400);
  });

  it('protects the scheduled reminder dispatcher with its server secret', async () => {
    const originalSecret = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const denied = await request(app).get('/api/cron/reminders');
    expect(denied.status).toBe(401);

    process.env.CRON_SECRET = 'test-cron-secret';
    const misconfigured = await request(app).get('/api/cron/reminders')
      .set('Authorization', 'Bearer test-cron-secret');
    expect(misconfigured.status).toBe(503);
    expect(misconfigured.body.error).toContain('Web Push');
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it('claims a due reminder and records a successful Web Push delivery', async () => {
    const original = {
      cron: process.env.CRON_SECRET,
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject: process.env.VAPID_SUBJECT,
    };
    const vapid = webpush.generateVAPIDKeys();
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
    process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
    const send = jest.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 55, user_id: 7, title: 'Échéance', details: 'Dossier AO-55', dossier_id: 3, dossier_reference: 'AO-55', delivery_attempts: 1 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [{ id: 12, user_id: 7, endpoint: 'https://fcm.googleapis.com/fcm/send/subscription/1', p256dh: 'public-key', auth: 'auth-key' }], rowCount: 1 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    try {
      const response = await request(app).get('/api/cron/reminders').set('Authorization', 'Bearer test-cron-secret');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ claimed: 1, sent: 1, failed: 0 });
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/fcm/send/subscription/1' }),
        expect.stringContaining('reminder-55'),
        expect.objectContaining({ TTL: 3600, urgency: 'high' }),
      );
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("delivery_status = 'sent'"), [[55]]);
    } finally {
      send.mockRestore();
      if (original.cron === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = original.cron;
      if (original.publicKey === undefined) delete process.env.VAPID_PUBLIC_KEY;
      else process.env.VAPID_PUBLIC_KEY = original.publicKey;
      if (original.privateKey === undefined) delete process.env.VAPID_PRIVATE_KEY;
      else process.env.VAPID_PRIVATE_KEY = original.privateKey;
      if (original.subject === undefined) delete process.env.VAPID_SUBJECT;
      else process.env.VAPID_SUBJECT = original.subject;
    }
  });

  it('denies dashboard access to reader accounts', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${readerToken}`);
    expect(response.status).toBe(403);
  });

  it('restricts the change log to administrators', async () => {
    const managerToken = jwt.sign({ sub: '8', email: 'manager@gct.tn', role: 'manager' }, process.env.JWT_SECRET!);
    const response = await request(app).get('/api/audit').set('Authorization', `Bearer ${managerToken}`);
    expect(response.status).toBe(403);
  });

  it('returns only changed fields in audit values', async () => {
    const response = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data[0].old_values).toEqual({ status: 'evaluation' });
    expect(response.body.data[0].new_values).toEqual({ status: 'awarded' });
  });

  it('restricts configurable lists to administrators', async () => {
    const managerToken = jwt.sign({ sub: '8', email: 'manager@gct.tn', role: 'manager' }, process.env.JWT_SECRET!);
    const response = await request(app).get('/api/settings/options').set('Authorization', `Bearer ${managerToken}`);
    expect(response.status).toBe(403);
  });

  it('allows administrators to list and create configurable options', async () => {
    const listed = await request(app).get('/api/settings/options').set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    const created = await request(app).post('/api/settings/options').set('Authorization', `Bearer ${token}`).send({
      listKey: 'committee', value: 'CDA', labelFr: 'CDA', labelAr: 'CDA', sortOrder: 50,
    });
    expect(created.status).toBe(201);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO configurable_options'), ['committee', 'CDA', 'CDA', 'CDA', 50]);
  });

  it('filters dossier and contract lists to the authenticated reader', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const dossiers = await request(app).get('/api/dossiers?page=1&pageSize=10').set('Authorization', `Bearer ${readerToken}`);
    const contracts = await request(app).get('/api/contracts?page=1&pageSize=10').set('Authorization', `Bearer ${readerToken}`);
    expect(dossiers.status).toBe(200);
    expect(contracts.status).toBe(200);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)::int AS total FROM dossiers WHERE owner_user_id = $1'), expect.arrayContaining([8]));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)::int AS total FROM contracts WHERE dossier_id IN (SELECT id FROM dossiers WHERE owner_user_id = $1)'), expect.arrayContaining([8]));
  });

  it('denies a reader access to an unassigned dossier detail', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app).get('/api/dossiers/3').set('Authorization', `Bearer ${readerToken}`);
    expect(response.status).toBe(404);
    expect(db.query).toHaveBeenCalledWith('SELECT * FROM dossiers WHERE id = $1 AND owner_user_id = $2', [3, 8]);
  });

  it('returns only the dossier owner and active administrators for a notification preview', async () => {
    const response = await request(app).get('/api/dossiers/3/compliance-recipients').set('Authorization', ['Bearer', token].join(' '));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      owner: { name: 'Admin Demo', email: demoUser.email },
      contributors: [],
      administrators: [{ full_name: 'Admin Demo', email: demoUser.email }],
    });
  });

  it('explains when an existing database needs the dossier detail migration', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    db.query.mockRejectedValueOnce(Object.assign(new Error('column does not exist'), { code: '42703' }) as never);
    try {
      const response = await request(app).get('/api/dossiers/3').set('Authorization', ['Bearer', token].join(' '));
      expect(response.status).toBe(503);
      expect(response.body.error).toContain('npm run db:migrate:dossier-detail');
    } finally {
      errorLog.mockRestore();
    }
  });

  it('returns records for a selected dashboard chart segment', async () => {
    const response = await request(app).get('/api/dashboard/details?chart=dossiersByStatus&label=published').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ reference: 'AO-TEST-03', status: 'published' });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE status = $1'), ['published']);
  });

  it('rejects unsupported dashboard detail filters', async () => {
    const response = await request(app).get('/api/dashboard/details?chart=app_users&label=admin').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });

  it('returns a paginated AO list and constrains page size', async () => {
    const response = await request(app).get('/api/dossiers?page=1&pageSize=10&q=essai').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data[0].reference).toBe('AO-TEST-03');
    expect(response.body.pagination).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ILIKE $1'), expect.arrayContaining(['%essai%']));
    expect(db.query.mock.calls.some(([sql]) => sql.includes('status_manual_until <= NOW()'))).toBe(true);
  });

  it('loads a contract by ID for the edit form', async () => {
    const response = await request(app).get('/api/contracts/8').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: 8, contract_number: 'BC-2026-008' });
    expect(db.query).toHaveBeenCalledWith('SELECT c.* FROM contracts c LEFT JOIN dossiers d ON d.id = c.dossier_id WHERE c.id = $1', [8]);
  });

  it('loads and persists the complete dossier checklist', async () => {
    const headers = { Authorization: ['Bearer', token].join(' ') };
    const loaded = await request(app).get('/api/dossiers/3/tracking').set(headers);
    expect(loaded.status).toBe(200);
    expect(loaded.body.data).toHaveLength(25);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT s.step_key, saved.completed_at'), expect.any(Array));
    const saved = await request(app).put('/api/dossiers/3/tracking').set(headers).send({ steps: loaded.body.data });
    expect(saved.status).toBe(200);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO dossier_tracking_steps'), expect.arrayContaining([3, 'request_received', null, 7]));
  });

  it('creates a contract linked to an accessible dossier', async () => {
    const payload = {
      dossier_id: 3, contract_number: 'AP.26.3.0009', subject: 'Fournitures', holder: 'Entreprise test',
      amount: 2500, currency: 'TND', state: 'pending',
      date_first_legal_document: null, date_send_admin_signature: null, date_admin_signed_return: null,
      date_send_client_signature: null, date_client_signed_return: null, date_send_registration: null,
      date_registered_return: null, date_effective: null, date_end: null, date_archived: null,
    };
    const response = await request(app).post('/api/contracts').set('Authorization', ['Bearer', token].join(' ')).send(payload);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ dossier_id: 3, contract_number: payload.contract_number });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO contracts'), Object.values(payload));
  });

  it('updates contract business fields without accepting internal fields', async () => {
    const payload = {
      dossier_id: 3, contract_number: 'BC-2026-008', subject: 'Contrat modifié', holder: 'Titulaire test',
      amount: 1250, currency: 'TND', state: 'active', date_first_legal_document: null,
      date_send_admin_signature: null, date_admin_signed_return: null, date_send_client_signature: null,
      date_client_signed_return: null, date_send_registration: null, date_registered_return: null,
      date_effective: '2026-10-01', date_end: null, date_archived: null,
    };
    db.query.mockResolvedValueOnce({ rows: [{ id: 8, ...payload }], rowCount: 1 } as never);
    db.query.mockResolvedValueOnce({ rows: [{ id: 8, ...payload }], rowCount: 1 } as never);
    db.query.mockResolvedValueOnce({ rows: [{ id: 8, ...payload }], rowCount: 1 } as never);
    const response = await request(app).patch('/api/contracts/8').set('Authorization', `Bearer ${token}`).send(payload);
    expect(response.status).toBe(200);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('updated_at = NOW()'), [8, ...Object.values(payload)]);
  });

  it('rejects internal contract fields in update payloads', async () => {
    const response = await request(app).patch('/api/contracts/8').set('Authorization', `Bearer ${token}`).send({ id: 8 });
    expect(response.status).toBe(400);
  });

  it('returns the configured masks and commission thresholds', async () => {
    const response = await request(app).get('/api/reference-rules').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(defaultReferenceRules);
  });

  it('requires manager or admin role to create annual program entries', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app).post('/api/planning/annual').set('Authorization', `Bearer ${readerToken}`).send({});
    expect(response.status).toBe(403);
  });

  it('creates a dossier with validated fields', async () => {
    const payload = {
      reference: 'AG.26.3.0001', subject: 'Nouveau dossier', estimated_cost: 1250, estimated_currency: 'TND',
      provisional_bond_amount: null, launch_specification_reference: null, request_type: null,
      expense_nature: 'Services', procedure_type: 'Consultation', committee: 'Commission interne',
      owner_name: 'Admin Demo', owner_user_id: 7, status: 'draft', status_manually_set: false, is_urgent: true, via_tuneps: true, announcement_date: null, submission_deadline: '2026-11-15T16:30',
      bid_opening_date: '2026-11-16T09:00', committee_decision_date: null, specification_approval_date: null,
      evaluation_report_date: null, contract_notification_date: null, results_publication_date: null, provisional_bond_return_date: null,
      definitive_bond_request_date: null, contract_preparation_date: null,
    };
    const response = await request(app).post('/api/dossiers').set('Authorization', `Bearer ${token}`).send(payload);
    expect(response.status).toBe(201);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO dossiers'), [...Object.values(payload), null]);
  });

  it('requires confirmation for a manually selected status that contradicts dossier dates', async () => {
    const payload = {
      reference: 'AG.26.3.0002', subject: 'Dossier incohérent', estimated_cost: null, estimated_currency: 'TND',
      expense_nature: null, procedure_type: null, committee: null, owner_name: null, owner_user_id: null,
      status: 'evaluation', status_manually_set: false, announcement_date: null, submission_deadline: null,
      bid_opening_date: null, committee_decision_date: null, specification_approval_date: null,
      evaluation_report_date: null, contract_notification_date: null, results_publication_date: null,
      provisional_bond_return_date: null, definitive_bond_request_date: null, contract_preparation_date: null,
    };
    const response = await request(app).post('/api/dossiers')
      .set({ Authorization: ['Bearer', token].join(' ') })
      .send(payload);
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ requiresConfirmation: true, automaticStatus: 'draft' });
    expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO dossiers'), expect.anything());
  });

  it('stores confirmed inconsistent dossier statuses with a 24-hour expiry', async () => {
    const payload = {
      reference: 'AG.26.3.0003', subject: 'Dérogation temporaire', estimated_cost: null, estimated_currency: 'TND',
      expense_nature: null, procedure_type: null, committee: null, owner_name: null, owner_user_id: null,
      status: 'published', status_manually_set: false, announcement_date: null, submission_deadline: null,
      bid_opening_date: null, committee_decision_date: null, specification_approval_date: null,
      evaluation_report_date: null, contract_notification_date: null, results_publication_date: null,
      provisional_bond_return_date: null, definitive_bond_request_date: null, contract_preparation_date: null,
      confirm_status_override: true,
    };
    const response = await request(app).post('/api/dossiers').set({ Authorization: ['Bearer', token].join(' ') }).send(payload);
    expect(response.status).toBe(201);
    const insert = db.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO dossiers'));
    expect(insert?.[0]).toContain('status_manual_until');
    const expiry = insert?.[1]?.at(-1);
    expect(expiry).toBeInstanceOf(Date);
    if (!(expiry instanceof Date)) throw new Error('Expected a temporary status expiry date');
    expect(expiry.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
  });

  it('rejects dossier statuses outside the database contract', async () => {
    const response = await request(app).post('/api/dossiers').set('Authorization', `Bearer ${token}`).send({ status: 'en_preparation' });
    expect(response.status).toBe(400);
  });

  it('updates a dossier and records the updated timestamp', async () => {
    const payload = {
      reference: 'AG.26.3.0001', subject: 'Dossier modifié', estimated_cost: null, estimated_currency: 'TND',
      provisional_bond_amount: null, launch_specification_reference: null, request_type: null,
      expense_nature: null, procedure_type: null, committee: null, owner_name: null, owner_user_id: null, status: 'published', status_manually_set: false,
      is_urgent: false, via_tuneps: false, announcement_date: new Date().toISOString().slice(0, 10), submission_deadline: null, bid_opening_date: null, committee_decision_date: null,
      specification_approval_date: null, evaluation_report_date: null, contract_notification_date: null, results_publication_date: null, provisional_bond_return_date: null,
      definitive_bond_request_date: null, contract_preparation_date: null,
    };
    db.query.mockResolvedValueOnce({ rows: [{ id: 3, ...payload }], rowCount: 1 } as never);
    db.query.mockResolvedValueOnce({ rows: [{ id: 3, ...payload }], rowCount: 1 } as never);
    const response = await request(app).patch('/api/dossiers/3').set('Authorization', `Bearer ${token}`).send(payload);
    expect(response.status).toBe(200);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('status_manual_until ='), [3, ...Object.values(payload), null]);
  });

  it('requires confirmation when a dossier update selects an inconsistent status', async () => {
    const current = {
      id: 3, reference: 'AO-2026-TEST', subject: 'Dossier existant', estimated_cost: null, estimated_currency: 'TND',
      request_type: null,
      expense_nature: null, procedure_type: null, committee: null, owner_name: null, owner_user_id: null,
      status: 'draft', status_manually_set: false, is_urgent: false, via_tuneps: false, status_manual_until: null, announcement_date: null,
      submission_deadline: null, bid_opening_date: null, committee_decision_date: null, specification_approval_date: null,
      evaluation_report_date: null, contract_notification_date: null, results_publication_date: null,
      provisional_bond_return_date: null, definitive_bond_request_date: null, contract_preparation_date: null,
    };
    db.query.mockResolvedValueOnce({ rows: [current], rowCount: 1 } as never);
    const response = await request(app).patch('/api/dossiers/3')
      .set({ Authorization: ['Bearer', token].join(' ') })
      .send({ ...current, status: 'evaluation' });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ requiresConfirmation: true, automaticStatus: 'draft' });
    expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE dossiers SET reference ='), expect.anything());
  });

  it('allows the assigned dossier owner to update compliance fields only', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const current = {
      id: 3, reference: 'AG.26.3.0001', subject: 'Dossier responsable', estimated_cost: 10_000, estimated_currency: 'TND',
      provisional_bond_amount: null, launch_specification_reference: null, request_type: 'Étude',
      expense_nature: null, procedure_type: null, committee: 'CRA', owner_name: 'Responsable', owner_user_id: 8,
      status: 'draft', status_manually_set: false, is_urgent: false, via_tuneps: false, status_manual_until: null,
      announcement_date: null, submission_deadline: null, bid_opening_date: null, committee_decision_date: null,
      specification_approval_date: null, evaluation_report_date: null, contract_notification_date: null,
      results_publication_date: null, provisional_bond_return_date: null, definitive_bond_request_date: null,
      contract_preparation_date: null,
    };
    const updated = { ...current, via_tuneps: true };
    db.query.mockResolvedValueOnce({ rows: [current], rowCount: 1 } as never);
    db.query.mockResolvedValueOnce({ rows: [updated], rowCount: 1 } as never);
    const response = await request(app).patch('/api/dossiers/3')
      .set('Authorization', ['Bearer', readerToken].join(' '))
      .send({ ...current, via_tuneps: true });
    expect(response.status).toBe(200);
    expect(response.body.data.via_tuneps).toBe(true);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE dossiers SET'), expect.any(Array));
  });

  it('prevents a dossier owner from changing non-compliance fields', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const current = {
      id: 3, reference: 'AG.26.3.0001', subject: 'Dossier responsable', estimated_cost: 10_000, estimated_currency: 'TND',
      provisional_bond_amount: null, launch_specification_reference: null, request_type: 'Étude',
      expense_nature: null, procedure_type: null, committee: 'CRA', owner_name: 'Responsable', owner_user_id: 8,
      status: 'draft', status_manually_set: false, is_urgent: false, via_tuneps: false, status_manual_until: null,
      announcement_date: null, submission_deadline: null, bid_opening_date: null, committee_decision_date: null,
      specification_approval_date: null, evaluation_report_date: null, contract_notification_date: null,
      results_publication_date: null, provisional_bond_return_date: null, definitive_bond_request_date: null,
      contract_preparation_date: null,
    };
    db.query.mockResolvedValueOnce({ rows: [current], rowCount: 1 } as never);
    const response = await request(app).patch('/api/dossiers/3')
      .set('Authorization', ['Bearer', readerToken].join(' '))
      .send({ ...current, subject: 'Sujet modifié sans autorisation' });
    expect(response.status).toBe(403);
    expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE dossiers SET'), expect.anything());
  });

  it('restricts dossier deletion to administrators', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app).delete('/api/dossiers/3').set('Authorization', `Bearer ${readerToken}`);
    expect(response.status).toBe(403);
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
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, email, full_name, role, matricule, fonction, tel, is_active, created_at'));
    expect(response.text).not.toContain('password_hash');
  });

  it('creates overtime for the authenticated user and calculates the hours', async () => {
    const response = await request(app).post('/api/overtime').set('Authorization', `Bearer ${token}`).send({
      workDate: '2026-10-14', startTime: '17:00', endTime: '19:30', period: '2026', comment: 'Essai',
    });
    expect(response.status).toBe(201);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO overtime_entries'), [7, '2026-10-14', '17:00', '19:30', 2.5, 'Essai', '2026']);
  });

  it('rejects invalid overtime input', async () => {
    const response = await request(app).post('/api/overtime').set('Authorization', `Bearer ${token}`).send({ workDate: 'invalid' });
    expect(response.status).toBe(400);
  });

  it('creates accounts with a hashed password', async () => {
    const response = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({
      email: 'new.user@gct.tn', name: 'Nouvel utilisateur', password: 'Secret123!', role: 'reader', matricule: 'GCT-002',
    });
    expect(response.status).toBe(201);
    const insertCall = db.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app_users'));
    expect(insertCall?.[1]).toEqual(['new.user@gct.tn', 'Nouvel utilisateur', expect.not.stringContaining('Secret123!'), 'reader', 'GCT-002', null, null]);
  });

  it('updates account details without replacing an omitted password', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 7, email: demoUser.email }], rowCount: 1 } as never);
    const response = await request(app).patch('/api/users/7').set('Authorization', `Bearer ${token}`).send({
      email: demoUser.email, name: 'Admin modifié', role: 'admin', matricule: 'GCT-001', fonction: 'Gestion', tel: '12345678',
    });
    expect(response.status).toBe(200);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('password_hash = COALESCE($4, password_hash)'), [7, demoUser.email, 'Admin modifié', null, 'admin', 'GCT-001', 'Gestion', '12345678']);
  });

  it('does not allow non-admins to create accounts', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app).post('/api/users').set('Authorization', `Bearer ${readerToken}`).send({});
    expect(response.status).toBe(403);
  });

  it('creates a clarification request only through the validated API contract', async () => {
    const response = await request(app).post('/api/clarifications').set('Authorization', `Bearer ${token}`).send({ dossierId: '1', subject: 'Précision sur le délai' });
    expect(response.status).toBe(201);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO clarification_requests'), [1, 'Précision sur le délai', null, null, null]);
  });

  it('creates a dossier remark for the authenticated user', async () => {
    const response = await request(app).post('/api/notes').set('Authorization', `Bearer ${token}`).send({ dossierId: '1', body: 'Pièce reçue pour examen.' });
    expect(response.status).toBe(201);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO dossier_notes'), [1, 7, 'Pièce reçue pour examen.']);
  });

  it('does not allow readers to assign reminders to other users', async () => {
    const readerToken = jwt.sign({ sub: '8', email: 'reader@gct.tn', role: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app).post('/api/reminders').set('Authorization', `Bearer ${readerToken}`).send({
      title: 'Rappel partagé', reminderAt: '2026-10-20T10:00:00.000Z', assignToUserId: 7,
    });
    expect(response.status).toBe(403);
  });

  it('transmits one reminder to multiple users with an inclusive visibility date', async () => {
    const managerToken = jwt.sign({ sub: '8', email: 'manager@gct.tn', role: 'manager' }, process.env.JWT_SECRET!);
    const response = await request(app).post('/api/reminders').set('Authorization', `Bearer ${managerToken}`).send({
      title: 'Réunion de suivi', details: 'Préparer les pièces.', reminderAt: '2026-10-20T09:00:00.000Z',
      assignToUserIds: [11, 12, 11], visibleUntil: '2026-10-25',
    });
    expect(response.status).toBe(201);
    expect(response.body.data).toHaveLength(2);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('id = ANY($1::bigint[])'), [[11, 12]]);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('visible_until'), [11, 8, 'Réunion de suivi', 'Préparer les pièces.', '2026-10-20T09:00:00.000Z', 'normal', 0, '2026-10-25']);
    await request(app).get('/api/reminders').set('Authorization', `Bearer ${token}`);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('visible_until >= CURRENT_DATE'), [7]);
  });

  it('requires a visibility end date when a reminder is transmitted', async () => {
    const response = await request(app).post('/api/reminders').set('Authorization', `Bearer ${token}`).send({
      title: 'Rappel transmis', reminderAt: '2026-10-20T09:00:00.000Z', assignToUserIds: [11],
    });
    expect(response.status).toBe(400);
  });

});
