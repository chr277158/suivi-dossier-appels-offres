import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import type { PoolClient } from 'pg';
import webpush from 'web-push';
import { z } from 'zod';
import { buildBusinessNotifications, type BusinessDossier } from './business-notifications';
import { pool, Queryable } from './db';
import { defaultReferenceRules, referenceRulesSchema, referenceValidationError } from './reference-rules';
import { calculateSurveillanceDueDate, defaultSurveillanceRules, surveillanceRulesSchema } from './surveillance-rules';

const accessSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return secret;
};
const refreshCookie = process.env.NODE_ENV === 'production' ? '__Host-refresh_token' : 'refresh_token';
const refreshCookiePath = process.env.NODE_ENV === 'production' ? '/' : '/api/auth';
const authIssuer = 'gct-procurement';
const authAudience = 'gct-procurement-api';
function setRefreshCookie(response: Response, token: string) {
  response.cookie(refreshCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000, path: refreshCookiePath });
}
function clearRefreshCookie(response: Response) {
  response.clearCookie(refreshCookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: refreshCookiePath });
}
type Role = 'admin' | 'manager' | 'reader';
type UserClaims = { sub: string; email: string; role: Role };
type AuthRequest = Request & { user?: UserClaims };

const formFieldLabels: Record<string, string> = {
  identifier: 'Matricule ou adresse e-mail', password: 'Mot de passe',
  dossier_id: 'Dossier associé', reference: 'Référence', subject: 'Objet',
  estimated_cost: 'Budget estimé', estimated_currency: 'Devise', provisional_bond_amount: 'Montant de la caution provisoire',
  provisional_bond_return_status: 'État de restitution de la caution provisoire', launch_specification_status: 'État du cahier des charges',
  request_type: 'Type de demande', expense_nature: 'Nature de la dépense', procedure_type: 'Type de procédure',
  committee: 'Commission', owner_name: 'Responsable', owner_user_id: 'Responsable', status: 'Statut',
  announcement_date: 'Date de publication', submission_deadline: 'Date limite de remise des offres', bid_opening_date: 'Date d’ouverture des plis',
  committee_decision_date: 'Date de décision de la commission', specification_approval_date: 'Date d’approbation du cahier des charges',
  evaluation_report_date: 'Date du rapport d’évaluation', contract_notification_date: 'Date de notification du contrat',
  results_publication_date: 'Date de publication des résultats', provisional_bond_return_date: 'Date de restitution de la caution provisoire',
  definitive_bond_request_date: 'Date de demande de la caution définitive', contract_preparation_date: 'Date de préparation du contrat',
  date_first_legal_document: 'Date du premier document légal', date_send_admin_signature: 'Date d’envoi pour signature administrative',
  date_admin_signed_return: 'Date de retour de la signature administrative', date_send_client_signature: 'Date d’envoi pour signature du titulaire',
  date_client_signed_return: 'Date de retour de la signature du titulaire', date_send_registration: 'Date d’envoi à l’enregistrement',
  date_registered_return: 'Date de retour de l’enregistrement', date_effective: 'Date de prise d’effet', date_end: 'Date de fin', date_archived: 'Date d’archivage',
  contract_number: 'N° contrat', holder: 'Titulaire', amount: 'Montant', currency: 'Devise', state: 'État du contrat',
  fiscal_year: 'Année du plan', year: 'Année', title: 'Titre', details: 'Détail', reminderAt: 'Date et heure du rappel',
  importance: 'Priorité', leadMinutes: 'Délai de rappel', visibleUntil: 'Date de fin d’affichage',
  workDate: 'Date de travail', startTime: 'Heure de début', endTime: 'Heure de fin', period: 'Période', comment: 'Remarque',
  email: 'Adresse e-mail', name: 'Nom complet', role: 'Rôle', matricule: 'Matricule', fonction: 'Fonction', tel: 'Téléphone',
  dossierId: 'Dossier associé', body: 'Remarque', receivedAt: 'Date de réception', sentAt: 'Date d’envoi', response: 'Réponse',
  endpoint: 'Adresse du service de notification', p256dh: 'Clé de notification', auth: 'Clé d’authentification',
  step_key: 'Étape de suivi', completed_at: 'Date de réalisation',
  'masks.dossier': 'Masque de référence des dossiers', 'masks.contract': 'Masque des numéros de contrat', 'masks.annual': 'Masque du plan annuel',
  'thresholds.study.craMax': 'Seuil maximal CRA pour les études', 'thresholds.study.caeMax': 'Seuil maximal CAE pour les études',
  'thresholds.servicesAndGoods.craMin': 'Seuil minimal CRA pour les services et fournitures',
  'thresholds.servicesAndGoods.craMax': 'Seuil maximal CRA pour les services et fournitures',
  'thresholds.servicesAndGoods.caeMax': 'Seuil maximal CAE pour les services et fournitures',
  value: 'Valeur', labelFr: 'Libellé français', labelAr: 'Libellé arabe', listKey: 'Type de liste', sortOrder: 'Ordre d’affichage',
};

function formValidationMessage(error: z.ZodError, labels: Record<string, string> = {}) {
  const issue = error.issues[0];
  if (!issue) return 'Vérifiez les champs du formulaire.';
  if (issue.code === 'unrecognized_keys') return `Le formulaire contient un champ non reconnu : ${issue.keys.join(', ')}.`;
  const path = issue.path.map(String).join('.');
  const fieldKey = path || 'formulaire';
  const field = labels[path] ?? labels[fieldKey] ?? formFieldLabels[path] ?? formFieldLabels[String(issue.path.at(-1) ?? '')] ?? 'Ce champ';

  if (issue.code === 'invalid_type') {
    return issue.received === 'undefined' || issue.received === 'null' ? `Le champ « ${field} » est obligatoire.` : `Le champ « ${field} » n’a pas le bon format.`;
  }
  if (issue.code === 'too_small') {
    if (issue.type === 'string') return issue.minimum === 1 ? `Le champ « ${field} » est obligatoire.` : `Le champ « ${field} » doit contenir au moins ${issue.minimum} caractères.`;
    if (issue.type === 'number') return `Le champ « ${field} » doit être supérieur${issue.inclusive ? ' ou égal' : ''} à ${issue.minimum}.`;
    if (issue.type === 'array') return `Le champ « ${field} » doit contenir au moins ${issue.minimum} élément(s).`;
  }
  if (issue.code === 'too_big') {
    if (issue.type === 'string') return `Le champ « ${field} » ne peut pas dépasser ${issue.maximum} caractères.`;
    if (issue.type === 'number') return `Le champ « ${field} » doit être inférieur${issue.inclusive ? ' ou égal' : ''} à ${issue.maximum}.`;
    if (issue.type === 'array') return `Le champ « ${field} » ne peut pas contenir plus de ${issue.maximum} élément(s).`;
  }
  if (issue.code === 'invalid_string') {
    if (issue.validation === 'email') return `Le champ « ${field} » doit contenir une adresse e-mail valide.`;
    if (issue.validation === 'url') return `Le champ « ${field} » doit contenir une adresse URL valide.`;
    if (issue.validation === 'date') return `Le champ « ${field} » doit contenir une date valide au format AAAA-MM-JJ.`;
    if (issue.validation === 'datetime') return `Le champ « ${field} » doit contenir une date et une heure valides.`;
    return `Le champ « ${field} » ne respecte pas le format attendu.`;
  }
  if (issue.code === 'invalid_enum_value') return `Choisissez une valeur proposée pour le champ « ${field} ».`;
  if (issue.code === 'custom') {
    if (path.startsWith('thresholds.study')) return 'Le seuil maximal CAE pour les études doit être supérieur au seuil maximal CRA.';
    if (path.startsWith('thresholds.servicesAndGoods')) return 'Les seuils doivent respecter cet ordre : CRA minimal, CRA maximal, puis CAE maximal.';
    if (path === 'estimated_cost' || path === 'provisional_bond_amount') return `Le champ « ${field} » doit être un montant positif avec au maximum trois décimales.`;
    if (path.endsWith('_date') || path.endsWith('_deadline')) return `Le champ « ${field} » ne respecte pas l’ordre chronologique des dates du dossier.`;
    if (formFieldLabels[path]) return `La valeur du champ « ${field} » ne respecte pas la règle de cohérence attendue.`;
    return 'Vérifiez la cohérence des valeurs saisies.';
  }
  return `Vérifiez le champ « ${field} » puis réessayez.`;
}

function inactiveOptionMessage(listKey: string) {
  const labels: Record<string, string> = {
    expense_nature: 'nature de la dépense', procedure_type: 'type de procédure', committee: 'commission',
    dossier_status: 'statut du dossier', contract_state: 'état du contrat', reminder_importance: 'priorité du rappel',
  };
  return `La valeur choisie pour « ${labels[listKey] ?? 'ce champ'} » est désactivée ou n’existe plus. Choisissez une valeur active.`;
}

async function withTransaction<T>(db: Queryable, action: (transaction: Queryable) => Promise<T>) {
  const connect = (db as Queryable & { connect?: () => Promise<PoolClient> }).connect;
  if (!connect) return action(db);
  const client = await connect.call(db);
  const transaction: Queryable = { query: client.query.bind(client) };
  let active = false;
  try {
    await client.query('BEGIN');
    active = true;
    const result = await action(transaction);
    await client.query('COMMIT');
    active = false;
    return result;
  } catch (error) {
    if (active) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const dateFields = [
  'date_first_legal_document', 'date_send_admin_signature', 'date_admin_signed_return',
  'date_send_client_signature', 'date_client_signed_return', 'date_send_registration',
  'date_registered_return', 'date_effective', 'date_end', 'date_archived',
] as const;
function isSupportedPushEndpoint(value: string) {
  const endpoint = new URL(value);
  const hostname = endpoint.hostname.toLowerCase();
  return endpoint.protocol === 'https:'
    && (hostname === 'fcm.googleapis.com'
      || hostname === 'web.push.apple.com'
      || hostname === 'push.services.mozilla.com'
      || hostname.endsWith('.push.services.mozilla.com')
      || hostname.endsWith('.push.apple.com')
      || hostname.endsWith('.notify.windows.com'));
}
const contractFields = [
  'dossier_id', 'contract_number', 'subject', 'holder', 'amount', 'currency', 'state', ...dateFields,
] as const;
const dossierAmountSchema = z.number().finite().min(0).max(99_999_999_999.999)
  .refine((value) => !value.toString().includes('e') && (value.toString().split('.')[1]?.length ?? 0) <= 3, 'Montant limité à trois décimales')
  .nullable();
const contractSchema = z.object({
  dossier_id: z.number().int().positive().nullable(),
  contract_number: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(1).max(500),
  holder: z.string().trim().max(200).nullable(),
  amount: z.number().nonnegative().nullable(),
  currency: z.string().trim().length(3).regex(/^[A-Z]{3}$/),
  state: z.string().trim().min(1).max(40),
  date_first_legal_document: z.string().date().nullable(),
  date_send_admin_signature: z.string().date().nullable(),
  date_admin_signed_return: z.string().date().nullable(),
  date_send_client_signature: z.string().date().nullable(),
  date_client_signed_return: z.string().date().nullable(),
  date_send_registration: z.string().date().nullable(),
  date_registered_return: z.string().date().nullable(),
  date_effective: z.string().date().nullable(),
  date_end: z.string().date().nullable(),
  date_archived: z.string().date().nullable(),
}).strict();
const dossierFields = [
  'reference', 'subject', 'estimated_cost', 'estimated_currency', 'provisional_bond_amount', 'provisional_bond_return_status', 'launch_specification_status', 'request_type', 'expense_nature', 'procedure_type', 'committee', 'owner_name', 'owner_user_id', 'status', 'status_manually_set', 'is_urgent', 'via_tuneps',
  'announcement_date', 'submission_deadline', 'bid_opening_date', 'committee_decision_date',
  'specification_approval_date', 'evaluation_report_date', 'contract_notification_date', 'results_publication_date',
  'provisional_bond_return_date', 'definitive_bond_request_date', 'contract_preparation_date',
] as const;
const ownerEditableDossierFields = new Set<string>([
  'reference', 'estimated_cost', 'estimated_currency', 'request_type', 'committee', 'is_urgent', 'via_tuneps',
  'announcement_date', 'submission_deadline', 'bid_opening_date', 'results_publication_date',
]);
const dossierSchema = z.object({
  reference: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(1).max(500),
  estimated_cost: dossierAmountSchema,
  estimated_currency: z.string().trim().length(3).regex(/^[A-Z]{3}$/).default('TND'),
  provisional_bond_amount: dossierAmountSchema.default(null),
  provisional_bond_return_status: z.enum(['returned', 'not_returned']).default('not_returned'),
  launch_specification_status: z.enum(['completed', 'in_preparation']).default('in_preparation'),
  request_type: z.string().trim().max(120).nullable().default(null),
  expense_nature: z.string().trim().max(120).nullable(),
  procedure_type: z.string().trim().max(120).nullable(),
  committee: z.string().trim().max(160).nullable(),
  owner_name: z.string().trim().max(160).nullable(),
  owner_user_id: z.number().int().positive().nullable(),
  status: z.string().trim().min(1).max(40),
  status_manually_set: z.boolean().default(false),
  is_urgent: z.boolean().default(false),
  via_tuneps: z.boolean().default(false),
  confirm_status_override: z.boolean().default(false),
  announcement_date: z.string().date().nullable(),
  submission_deadline: z.string().datetime({ local: true }).nullable(),
  bid_opening_date: z.string().datetime({ local: true }).nullable(),
  committee_decision_date: z.string().date().nullable(),
  specification_approval_date: z.string().date().nullable(),
  evaluation_report_date: z.string().date().nullable(),
  contract_notification_date: z.string().date().nullable(),
  results_publication_date: z.string().date().nullable(),
  provisional_bond_return_date: z.string().date().nullable(),
  definitive_bond_request_date: z.string().date().nullable(),
  contract_preparation_date: z.string().date().nullable(),
}).superRefine((dossier, context) => {
  const dateOrder: [keyof typeof dossier, keyof typeof dossier][] = [
    ['specification_approval_date', 'announcement_date'],
    ['announcement_date', 'submission_deadline'],
    ['submission_deadline', 'bid_opening_date'],
    ['bid_opening_date', 'evaluation_report_date'],
    ['evaluation_report_date', 'committee_decision_date'],
    ['committee_decision_date', 'results_publication_date'],
    ['results_publication_date', 'contract_notification_date'],
  ];
  for (const [earlierKey, laterKey] of dateOrder) {
    const earlier = dossier[earlierKey];
    const later = dossier[laterKey];
    if (typeof earlier !== 'string' || typeof later !== 'string') continue;
    if (later.slice(0, 16) < earlier.slice(0, 16)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [laterKey],
        message: `${String(laterKey)} ne peut pas précéder ${String(earlierKey)}`,
      });
    }
  }
});
const trackingStepKeys = [
  'request_received', 'committee_appointed', 'needs_defined', 'specifications_drafted', 'specifications_validated',
  'committee_approved', 'funding_approved', 'launch_authorized', 'announcement_published', 'submission_closed',
  'bids_opened', 'offers_evaluated', 'evaluation_approved', 'committee_decision', 'award_notified',
  'results_published', 'provisional_bond_returned', 'definitive_bond_requested', 'definitive_bond_received',
  'contract_prepared', 'contract_signed', 'contract_approved', 'contract_registered', 'contract_notified', 'contract_effective',
] as const;
const trackingStepSchema = z.object({
  step_key: z.enum(trackingStepKeys),
  completed_at: z.string().date().nullable(),
}).strict();

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
function passwordPolicyError(value: unknown) {
  if (typeof value !== 'string') return null;
  if ([...value].length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (Buffer.byteLength(value, 'utf8') > 72) return 'Le mot de passe dépasse 72 octets, limite prise en charge par le hachage bcrypt.';
  return null;
}
const makeAccessToken = (claims: UserClaims) => jwt.sign(claims, accessSecret(), { algorithm: 'HS256', expiresIn: '10m', issuer: authIssuer, audience: authAudience });

function authenticate(request: AuthRequest, response: Response, next: NextFunction) {
  const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({ error: 'Authentification requise' });
  try {
    const decoded = jwt.verify(token, accessSecret(), { algorithms: ['HS256'], issuer: authIssuer, audience: authAudience });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.email !== 'string' || !['admin', 'manager', 'reader'].includes(String(decoded.role))) {
      return response.status(401).json({ error: 'Jeton invalide ou expiré' });
    }
    request.user = { sub: decoded.sub, email: decoded.email, role: decoded.role as Role };
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

function calculatedDossierStatus(row: z.infer<typeof dossierSchema>) {
  const today = new Date().toISOString().slice(0, 10);
  if (!row.announcement_date || row.announcement_date > today) return 'draft';
  if (row.bid_opening_date && String(row.bid_opening_date).slice(0, 10) <= today) return 'evaluation';
  return 'published';
}

export function createApp(db: Queryable = pool) {
  const app = express();
  app.use(helmet());
  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', (_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/auth', (request, response, next) => {
    const origin = request.header('origin');
    if (origin && !allowedOrigins.includes(origin)) return response.status(403).json({ error: 'Origine de la requête non autorisée.' });
    next();
  });
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/auth/refresh', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));

  async function writeAudit(request: AuthRequest, entityName: string, entityId: string, action: string, summary: string, oldValue: unknown, newValue: unknown, queryable: Queryable = db) {
    await queryable.query(
      'INSERT INTO audit_events (user_id, entity_name, entity_id, action, summary, old_values, new_values) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [Number(request.user!.sub), entityName, entityId, action, summary, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null],
    );
  }

  async function writeDossierOwnerHistory(queryable: Queryable, dossierId: number, previousOwnerId: number | null, previousOwnerName: string | null, newOwnerId: number | null, newOwnerName: string | null, actorId: number) {
    const actor = await queryable.query('SELECT full_name FROM app_users WHERE id = $1', [actorId]);
    await queryable.query(
      `INSERT INTO dossier_owner_history (dossier_id, previous_owner_user_id, previous_owner_name, new_owner_user_id, new_owner_name, transferred_by_user_id, transferred_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [dossierId, previousOwnerId, previousOwnerName, newOwnerId, newOwnerName, actorId, String(actor.rows[0]?.full_name ?? 'Utilisateur inconnu')],
    );
  }

  async function hasActiveOption(listKey: string, value: string) {
    const result = await db.query('SELECT 1 FROM configurable_options WHERE list_key = $1 AND option_value = $2 AND is_active = TRUE', [listKey, value]);
    return Boolean(result.rows[0]);
  }

  async function isAllowedCurrency(value: string) {
    const result = await db.query('SELECT is_active FROM configurable_options WHERE list_key = \'currency\' AND option_value = $1', [value]);
    return !result.rows[0] || result.rows[0].is_active;
  }

  async function getReferenceRules() {
    const result = await db.query('SELECT setting_value FROM application_settings WHERE setting_key = $1', ['reference_rules']);
    const parsed = referenceRulesSchema.safeParse(result.rows[0]?.setting_value ?? defaultReferenceRules);
    if (!parsed.success) throw new Error('La configuration des masques et seuils est invalide.');
    return parsed.data;
  }

  async function refreshExpiredDossierStatuses() {
    await db.query(
      `UPDATE dossiers
       SET status = CASE
         WHEN announcement_date IS NULL OR announcement_date > CURRENT_DATE THEN 'draft'
         WHEN bid_opening_date IS NOT NULL AND bid_opening_date <= CURRENT_DATE THEN 'evaluation'
         ELSE 'published'
       END,
       status_manually_set = FALSE,
       status_manual_until = NULL,
       updated_at = NOW()
       WHERE status_manual_until IS NOT NULL AND status_manual_until <= NOW()`,
    );
    await db.query(
      `UPDATE dossiers SET status = CASE
         WHEN announcement_date IS NULL OR announcement_date > CURRENT_DATE THEN 'draft'
         WHEN bid_opening_date IS NOT NULL AND bid_opening_date <= CURRENT_DATE THEN 'evaluation'
         ELSE 'published'
       END
       WHERE status_manually_set = FALSE AND status NOT IN ('awarded', 'unsuccessful', 'cancelled')`,
    );
  }

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
      const input = z.object({ identifier: z.string().trim().min(1).max(200), password: z.string().min(1) }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      if (Buffer.byteLength(input.data.password, 'utf8') > 72) return response.status(400).json({ error: 'Le mot de passe dépasse 72 octets, limite prise en charge par le hachage bcrypt.' });
      const result = await db.query('SELECT id, email, full_name, password_hash, role FROM app_users WHERE is_active = TRUE AND (LOWER(matricule) = LOWER($1) OR LOWER(email) = LOWER($1)) ORDER BY (LOWER(matricule) = LOWER($1)) DESC LIMIT 1', [input.data.identifier]);
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(input.data.password, user.password_hash))) {
        return response.status(401).json({ error: 'Le matricule ou l’adresse e-mail et le mot de passe ne correspondent pas à un compte actif.' });
      }
      const claims: UserClaims = { sub: String(user.id), email: user.email, role: user.role };
      const refreshToken = randomBytes(32).toString('base64url');
      await db.query('DELETE FROM refresh_sessions WHERE (expires_at < NOW() OR revoked_at IS NOT NULL) AND created_at < NOW() - INTERVAL \'60 days\'');
      await db.query('INSERT INTO refresh_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')', [user.id, hashToken(refreshToken)]);
      setRefreshCookie(response, refreshToken);
      return response.json({ accessToken: makeAccessToken(claims), user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/refresh', async (request, response, next) => {
    try {
      const token = request.cookies[refreshCookie];
      if (!token) return response.status(401).json({ error: 'Session absente' });
      const nextToken = randomBytes(32).toString('base64url');
      const rotated = await withTransaction(db, async (tx) => {
        const result = await tx.query('SELECT s.id, s.family_id, s.revoked_at, s.expires_at, s.last_used_at, u.id AS user_id, u.email, u.full_name, u.role, u.is_active FROM refresh_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.token_hash = $1 FOR UPDATE OF s', [hashToken(token)]);
        const session = result.rows[0];
        if (!session) return null;
        if (session.revoked_at) {
          await tx.query('UPDATE refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1', [session.family_id]);
          return null;
        }
        if (new Date(session.expires_at).getTime() <= Date.now() || Date.now() - new Date(session.last_used_at).getTime() > 7 * 24 * 60 * 60 * 1000 || !session.is_active) {
          await tx.query('UPDATE refresh_sessions SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL', [session.family_id]);
          return null;
        }
        const inserted = await tx.query('INSERT INTO refresh_sessions (user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4) RETURNING id', [session.user_id, session.family_id, hashToken(nextToken), session.expires_at]);
        await tx.query('UPDATE refresh_sessions SET revoked_at = NOW(), replaced_by_session_id = $2 WHERE id = $1', [session.id, inserted.rows[0].id]);
        return session;
      });
      if (!rotated) { clearRefreshCookie(response); return response.status(401).json({ error: 'Session expirée ou révoquée. Reconnectez-vous.' }); }
      setRefreshCookie(response, nextToken);
      return response.json({
        accessToken: makeAccessToken({ sub: String(rotated.user_id), email: rotated.email, role: rotated.role }),
        user: { id: rotated.user_id, email: rotated.email, fullName: rotated.full_name, role: rotated.role },
      });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/logout', async (request, response, next) => {
    try {
      const token = request.cookies[refreshCookie];
      if (token) {
        const session = await db.query('SELECT family_id FROM refresh_sessions WHERE token_hash = $1', [hashToken(token)]);
        if (session.rows[0]) await db.query('UPDATE refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1', [session.rows[0].family_id]);
      }
      clearRefreshCookie(response);
      return response.status(204).end();
    } catch (error) { next(error); }
  });

  app.get('/api/auth/me', authenticate, (request: AuthRequest, response) => response.json({ user: request.user }));

  app.get('/api/notifications/push', authenticate, async (request: AuthRequest, response, next) => {
    try {
      return response.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
    } catch (error) { next(error); }
  });

  app.post('/api/notifications/push', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({
        endpoint: z.string().url().refine(isSupportedPushEndpoint),
        expirationTime: z.number().nullable().optional(),
        keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }).strict(),
      }).strict().safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      await db.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = NOW()`,
        [Number(request.user!.sub), input.data.endpoint, input.data.keys.p256dh, input.data.keys.auth],
      );
      return response.status(204).end();
    } catch (error) { next(error); }
  });

  app.delete('/api/notifications/push', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ endpoint: z.string().url() }).strict().safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      await db.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [Number(request.user!.sub), input.data.endpoint]);
      return response.status(204).end();
    } catch (error) { next(error); }
  });

  app.get('/api/cron/reminders', async (request, response, next) => {
    try {
      const secret = process.env.CRON_SECRET;
      if (!secret || !request.get('authorization')) return response.status(401).json({ error: 'Accès refusé' });
      const expected = Buffer.from(`Bearer ${secret}`);
      const actual = Buffer.from(request.get('authorization')!);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return response.status(401).json({ error: 'Accès refusé' });
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      const subject = process.env.VAPID_SUBJECT;
      if (!publicKey || !privateKey || !subject) return response.status(503).json({ error: 'Configuration Web Push incomplète' });
      webpush.setVapidDetails(subject, publicKey, privateKey);
      await db.query(
        `UPDATE user_reminders
         SET delivery_status = 'failed', delivery_claimed_at = NULL, next_delivery_at = NULL,
             last_delivery_error = COALESCE(last_delivery_error, 'Traitement interrompu après la dernière tentative.')
         WHERE delivery_status = 'sending'
           AND delivery_attempts >= 5
           AND delivery_claimed_at < NOW() - INTERVAL '5 minutes'`,
      );

      const claimed = await db.query(
        `WITH due AS (
           SELECT r.id
           FROM user_reminders r
           WHERE r.is_sent = FALSE
               AND (r.visible_until IS NULL OR r.visible_until >= CURRENT_DATE)
             AND r.reminder_at - make_interval(mins => r.lead_minutes) <= NOW()
             AND r.delivery_attempts < 5
             AND (
               r.delivery_status = 'pending'
               OR (r.delivery_status = 'failed' AND r.next_delivery_at <= NOW())
               OR (r.delivery_status = 'sending' AND r.delivery_claimed_at < NOW() - INTERVAL '5 minutes')
             )
             AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = r.user_id)
           ORDER BY r.reminder_at
           FOR UPDATE SKIP LOCKED
           LIMIT 25
         )
         UPDATE user_reminders r
         SET delivery_status = 'sending',
             delivery_attempts = delivery_attempts + 1,
             delivery_claimed_at = NOW(),
             last_delivery_error = NULL
         FROM due
         WHERE r.id = due.id
         RETURNING r.id, r.user_id, r.title, r.details, r.dossier_id,
           (SELECT d.reference FROM dossiers d WHERE d.id = r.dossier_id) AS dossier_reference,
           r.delivery_attempts`,
      );
      const subscriptions = claimed.rows.length
        ? await db.query(
          'SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1::bigint[])',
          [[...new Set(claimed.rows.map((reminder) => Number(reminder.user_id)))]],
        )
        : { rows: [] };
      const subscriptionsByUser = new Map<string, typeof subscriptions.rows>();
      for (const subscription of subscriptions.rows) {
        const key = String(subscription.user_id);
        subscriptionsByUser.set(key, [...(subscriptionsByUser.get(key) ?? []), subscription]);
      }
      const deliveries = await Promise.all(claimed.rows.flatMap((reminder) => {
        const userSubscriptions = subscriptionsByUser.get(String(reminder.user_id)) ?? [];
        const payload = JSON.stringify({
          title: reminder.title,
          body: reminder.details || reminder.dossier_reference || 'Un rappel arrive à échéance.',
          url: reminder.dossier_id ? `/#/dossiers/${reminder.dossier_id}/edit` : '/#/reminders',
          tag: `reminder-${reminder.id}`,
        });
        return userSubscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification({
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            }, payload, { TTL: 3600, urgency: 'high' });
            return { reminderId: Number(reminder.id), subscriptionId: Number(subscription.id), ok: true as const };
          } catch (cause) {
            const statusCode = (cause as Error & { statusCode?: number }).statusCode;
            const message = cause instanceof Error ? cause.message.slice(0, 1000) : 'Échec Web Push inconnu';
            return { reminderId: Number(reminder.id), subscriptionId: Number(subscription.id), ok: false as const, statusCode, message };
          }
        });
      }));
      const expiredSubscriptionIds = deliveries
        .filter((delivery) => !delivery.ok && (delivery.statusCode === 404 || delivery.statusCode === 410))
        .map((delivery) => delivery.subscriptionId);
      if (expiredSubscriptionIds.length) {
        await db.query('DELETE FROM push_subscriptions WHERE id = ANY($1::bigint[])', [expiredSubscriptionIds]);
      }

      const sentIds: number[] = [];
      const failedIds: number[] = [];
      const failedDelays: number[] = [];
      const failedMessages: string[] = [];
      const pendingIds: number[] = [];
      for (const reminder of claimed.rows) {
        const reminderId = Number(reminder.id);
        const userSubscriptions = subscriptionsByUser.get(String(reminder.user_id)) ?? [];
        if (userSubscriptions.length === 0) {
          pendingIds.push(reminderId);
          continue;
        }
        const results = deliveries.filter((delivery) => delivery.reminderId === reminderId);
        if (results.some((delivery) => delivery.ok)) {
          sentIds.push(reminderId);
          continue;
        }
        failedIds.push(reminderId);
        failedDelays.push([1, 5, 15, 60, 360][Math.min(Number(reminder.delivery_attempts) - 1, 4)]);
        failedMessages.push(results.map((delivery) => delivery.ok ? null : delivery.message).filter(Boolean).join('; ').slice(0, 1000));
      }
      if (sentIds.length) {
        await db.query(
          "UPDATE user_reminders SET is_sent = TRUE, delivery_status = 'sent', delivery_claimed_at = NULL, next_delivery_at = NULL, last_delivery_error = NULL WHERE id = ANY($1::bigint[]) AND delivery_status = 'sending'",
          [sentIds],
        );
      }
      if (failedIds.length) {
        await db.query(
          `UPDATE user_reminders r
           SET delivery_status = 'failed', delivery_claimed_at = NULL,
               next_delivery_at = CASE WHEN r.delivery_attempts < 5 THEN NOW() + (failures.delay_minutes * INTERVAL '1 minute') ELSE NULL END,
               last_delivery_error = failures.message
           FROM UNNEST($1::bigint[], $2::integer[], $3::text[]) AS failures(id, delay_minutes, message)
           WHERE r.id = failures.id AND r.delivery_status = 'sending'`,
          [failedIds, failedDelays, failedMessages],
        );
      }
      if (pendingIds.length) {
        await db.query(
          "UPDATE user_reminders SET delivery_status = 'pending', delivery_attempts = GREATEST(delivery_attempts - 1, 0), delivery_claimed_at = NULL WHERE id = ANY($1::bigint[]) AND delivery_status = 'sending'",
          [pendingIds],
        );
      }
      return response.json({ claimed: claimed.rows.length, sent: sentIds.length, failed: failedIds.length });
    } catch (error) { next(error); }
  });

  const optionLists = ['expense_nature', 'procedure_type', 'committee', 'currency', 'dossier_status', 'contract_state', 'reminder_importance'] as const;
  const optionListSchema = z.enum(optionLists);

  app.get('/api/options', authenticate, async (request, response, next) => {
    try {
      const listKey = z.string().optional().safeParse(request.query.listKey);
      if (!listKey.success) return response.status(400).json({ error: 'Liste invalide' });
      const keys = listKey.data ? [optionListSchema.safeParse(listKey.data)] : optionLists.map((key) => ({ success: true as const, data: key }));
      if (keys.some((key) => !key.success)) return response.status(400).json({ error: 'Liste invalide' });
      const result = await db.query('SELECT list_key, option_value, label_fr, label_ar, sort_order FROM configurable_options WHERE is_active = TRUE AND list_key = ANY($1::text[]) ORDER BY list_key, sort_order, id', [keys.map((key) => key.data)]);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/settings/options', authenticate, requireRoles('admin'), async (_request, response, next) => {
    try {
      const result = await db.query('SELECT id, list_key, option_value, label_fr, label_ar, sort_order, is_active FROM configurable_options ORDER BY list_key, sort_order, id');
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/reference-rules', authenticate, async (_request, response, next) => {
    try {
      return response.json({ data: await getReferenceRules() });
    } catch (error) { next(error); }
  });

  app.put('/api/settings/reference-rules', authenticate, requireRoles('admin'), async (request, response, next) => {
    try {
      const input = referenceRulesSchema.safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const result = await db.query(
        `INSERT INTO application_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
         RETURNING setting_value`,
        ['reference_rules', JSON.stringify(input.data)],
      );
      return response.json({ data: result.rows[0]?.setting_value ?? input.data });
    } catch (error) { next(error); }
  });

  app.get('/api/settings/surveillance-rules', authenticate, requireRoles('admin'), async (_request, response, next) => {
    try {
      const result = await db.query('SELECT setting_value FROM application_settings WHERE setting_key = $1', ['surveillance_rules']);
      const parsed = surveillanceRulesSchema.safeParse(result.rows[0]?.setting_value ?? defaultSurveillanceRules);
      if (!parsed.success) return response.status(500).json({ error: 'Les règles de surveillance enregistrées sont invalides.' });
      return response.json({ data: parsed.data });
    } catch (error) { next(error); }
  });

  app.get('/api/surveillance/rules', authenticate, async (_request, response, next) => {
    try {
      const result = await db.query('SELECT setting_value FROM application_settings WHERE setting_key = $1', ['surveillance_rules']);
      const parsed = surveillanceRulesSchema.safeParse(result.rows[0]?.setting_value ?? defaultSurveillanceRules);
      if (!parsed.success) return response.status(500).json({ error: 'Les règles de surveillance enregistrées sont invalides.' });
      return response.json({ data: parsed.data });
    } catch (error) { next(error); }
  });

  app.put('/api/settings/surveillance-rules', authenticate, requireRoles('admin'), async (request: AuthRequest, response, next) => {
    try {
      const input = surveillanceRulesSchema.safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const result = await db.query(
        `INSERT INTO application_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
         RETURNING setting_value`,
        ['surveillance_rules', JSON.stringify(input.data)],
      );
      await writeAudit(request, 'application_settings', 'surveillance_rules', 'update', 'Modification des règles de surveillance', null, input.data);
      return response.json({ data: result.rows[0]?.setting_value ?? input.data });
    } catch (error) { next(error); }
  });

  app.get('/api/surveillance/events', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const [events, configResult] = await Promise.all([
        db.query(
          `SELECT e.*, d.reference AS dossier_reference, d.subject AS dossier_subject,
             c.contract_number, c.subject AS contract_subject, a.id AS annual_program_id,
             a.reference AS annual_reference, a.subject AS annual_subject,
             COALESCE(d.owner_user_id, e.created_by_user_id) AS responsible_user_id
           FROM surveillance_events e
           LEFT JOIN dossiers d ON d.id = e.dossier_id
           LEFT JOIN contracts c ON c.id = e.contract_id
           LEFT JOIN dossiers cd ON cd.id = c.dossier_id
           LEFT JOIN annual_programs a ON a.id = e.annual_program_id
           WHERE ($1::boolean OR d.owner_user_id = $2 OR cd.owner_user_id = $2 OR e.created_by_user_id = $2)
           ORDER BY e.started_at DESC, e.id DESC`,
          [privileged, Number(request.user!.sub)],
        ),
        db.query('SELECT setting_value FROM application_settings WHERE setting_key = $1', ['surveillance_rules']),
      ]);
      const parsed = surveillanceRulesSchema.safeParse(configResult.rows[0]?.setting_value ?? defaultSurveillanceRules);
      const rules = parsed.success ? parsed.data.rules : defaultSurveillanceRules.rules;
      const byKey = new Map(rules.map((rule) => [rule.key, rule]));
      return response.json({ data: events.rows.map((row) => {
        const rule = byKey.get(String(row.rule_key));
        return { ...row, rule_label: rule?.label ?? row.rule_key, due_date: rule ? calculateSurveillanceDueDate(String(row.started_at), rule.delay, rule.unit, parsed.success ? parsed.data.holidays : defaultSurveillanceRules.holidays) : null };
      }) });
    } catch (error) { next(error); }
  });

  app.post('/api/surveillance/events', authenticate, requireRoles('admin', 'manager'), async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ ruleKey: z.string().regex(/^[a-z0-9_]+$/).max(60), dossierId: z.number().int().positive().nullable(), contractId: z.number().int().positive().nullable(), annualProgramId: z.number().int().positive().nullable(), startedAt: z.string().date(), completedAt: z.string().date().nullable().default(null), note: z.string().trim().max(2000).nullable().default(null) }).strict().safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      if (Number(Boolean(input.data.dossierId)) + Number(Boolean(input.data.contractId)) + Number(Boolean(input.data.annualProgramId)) !== 1) return response.status(400).json({ error: 'Sélectionnez un dossier, un contrat ou une ligne du plan annuel pour rattacher cette échéance.' });
      const configResult = await db.query('SELECT setting_value FROM application_settings WHERE setting_key = $1', ['surveillance_rules']);
      const config = surveillanceRulesSchema.safeParse(configResult.rows[0]?.setting_value ?? defaultSurveillanceRules);
      if (!config.success || !config.data.rules.some((rule) => rule.key === input.data.ruleKey && rule.enabled)) return response.status(400).json({ error: 'Cette règle est désactivée ou n’existe pas dans les paramètres de surveillance.' });
      if (input.data.completedAt && input.data.completedAt < input.data.startedAt) return response.status(400).json({ error: 'La date de réalisation doit être égale ou postérieure à la date de départ.' });
      if (input.data.dossierId) {
        const access = await db.query('SELECT id FROM dossiers WHERE id = $1', [input.data.dossierId]);
        if (!access.rowCount) return response.status(404).json({ error: 'Le dossier sélectionné est introuvable.' });
      }
      if (input.data.contractId) {
        const access = await db.query('SELECT id FROM contracts WHERE id = $1', [input.data.contractId]);
        if (!access.rowCount) return response.status(404).json({ error: 'Le contrat sélectionné est introuvable.' });
      }
      if (input.data.annualProgramId) {
        const access = await db.query('SELECT id FROM annual_programs WHERE id = $1', [input.data.annualProgramId]);
        if (!access.rowCount) return response.status(404).json({ error: 'La ligne du plan annuel sélectionnée est introuvable.' });
      }
      const result = await db.query(
        `INSERT INTO surveillance_events (rule_key, dossier_id, contract_id, annual_program_id, started_at, completed_at, note, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [input.data.ruleKey, input.data.dossierId, input.data.contractId, input.data.annualProgramId, input.data.startedAt, input.data.completedAt, input.data.note, Number(request.user!.sub)],
      );
      await writeAudit(request, 'surveillance_events', String(result.rows[0].id), 'create', `Création de l’échéance ${input.data.ruleKey}`, null, result.rows[0]);
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.patch('/api/surveillance/events/:id', authenticate, requireRoles('admin', 'manager'), async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      const input = z.object({ completedAt: z.string().date().nullable(), note: z.string().trim().max(2000).nullable() }).strict().safeParse(request.body);
      if (!id.success || !input.success) return response.status(400).json({ error: input.success ? 'Identifiant d’échéance invalide.' : formValidationMessage(input.error) });
      const before = await db.query('SELECT * FROM surveillance_events WHERE id = $1', [id.data]);
      if (!before.rowCount) return response.status(404).json({ error: 'L’échéance demandée est introuvable.' });
      if (input.data.completedAt && input.data.completedAt < String(before.rows[0].started_at).slice(0, 10)) return response.status(400).json({ error: 'La date de réalisation doit être égale ou postérieure à la date de départ.' });
      const result = await db.query('UPDATE surveillance_events SET completed_at = $2, note = $3, updated_at = NOW() WHERE id = $1 RETURNING *', [id.data, input.data.completedAt, input.data.note]);
      await writeAudit(request, 'surveillance_events', String(id.data), 'update', 'Mise à jour de l’échéance de surveillance', before.rows[0], result.rows[0]);
      return response.json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.post('/api/settings/options', authenticate, requireRoles('admin'), async (request, response, next) => {
    try {
      const input = z.object({ listKey: optionListSchema, value: z.string().trim().min(1).max(80), labelFr: z.string().trim().min(1).max(120), labelAr: z.string().trim().min(1).max(120), sortOrder: z.number().int().default(0) }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const result = await db.query('INSERT INTO configurable_options (list_key, option_value, label_fr, label_ar, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id, list_key, option_value, label_fr, label_ar, sort_order, is_active', [input.data.listKey, input.data.value, input.data.labelFr, input.data.labelAr, input.data.sortOrder]);
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.patch('/api/settings/options/:id', authenticate, requireRoles('admin'), async (request, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      const input = z.object({ labelFr: z.string().trim().min(1).max(120).optional(), labelAr: z.string().trim().min(1).max(120).optional(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() }).strict().safeParse(request.body);
      if (!id.success) return response.status(400).json({ error: 'L’identifiant de l’option doit être un entier positif.' });
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      if (Object.keys(input.data).length === 0) return response.status(400).json({ error: 'Modifiez au moins un libellé, l’ordre d’affichage ou l’état de l’option.' });
      const fields: Record<string, unknown> = { label_fr: input.data.labelFr, label_ar: input.data.labelAr, sort_order: input.data.sortOrder, is_active: input.data.isActive };
      const changes = Object.entries(fields).filter(([, value]) => value !== undefined);
      const assignments = changes.map(([field], index) => `${field} = $${index + 2}`);
      const result = await db.query(`UPDATE configurable_options SET ${assignments.join(', ')} WHERE id = $1 RETURNING id, list_key, option_value, label_fr, label_ar, sort_order, is_active`, [id.data, ...changes.map(([, value]) => value)]);
      return result.rows[0] ? response.json({ data: result.rows[0] }) : response.status(404).json({ error: 'Option introuvable' });
    } catch (error) { next(error); }
  });

  app.delete('/api/settings/options/:id', authenticate, requireRoles('admin'), async (request, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant invalide' });
      const result = await db.query('UPDATE configurable_options SET is_active = FALSE WHERE id = $1 RETURNING id', [id.data]);
      return result.rows[0] ? response.status(204).end() : response.status(404).json({ error: 'Option introuvable' });
    } catch (error) { next(error); }
  });

  app.get('/api/dashboard/stats', authenticate, requireRoles('admin', 'manager'), async (_request, response, next) => {
    try {
      await refreshExpiredDossierStatuses();
      const [dossiers, contracts, expenses, procedures, overdue] = await Promise.all([
        db.query('SELECT status AS label, COUNT(*)::int AS value FROM dossiers GROUP BY status ORDER BY status'),
        db.query('SELECT state AS label, COUNT(*)::int AS value FROM contracts GROUP BY state ORDER BY state'),
        db.query("SELECT COALESCE(expense_nature, 'Non renseignée') AS label, COUNT(*)::int AS value FROM dossiers GROUP BY expense_nature ORDER BY label"),
        db.query("SELECT COALESCE(procedure_type, 'Non renseignée') AS label, COUNT(*)::int AS value FROM dossiers GROUP BY procedure_type ORDER BY procedure_type"),
        db.query("SELECT id, reference, subject, submission_deadline FROM dossiers WHERE submission_deadline < LOCALTIMESTAMP AND status IN ('draft', 'published', 'evaluation') ORDER BY submission_deadline LIMIT 10"),
      ]);
      return response.json({ charts: { dossiersByStatus: dossiers.rows, contractsByState: contracts.rows, dossiersByExpenseNature: expenses.rows, dossiersByProcedure: procedures.rows }, alerts: { overdueCount: overdue.rowCount ?? overdue.rows.length, overdueDossiers: overdue.rows } });
    } catch (error) { next(error); }
  });

  app.get('/api/dashboard/details', authenticate, requireRoles('admin', 'manager'), async (request, response, next) => {
    try {
      const input = z.object({
        chart: z.enum(['dossiersByStatus', 'contractsByState', 'dossiersByExpenseNature', 'dossiersByProcedure']),
        label: z.string().trim().min(1).max(120),
      }).safeParse(request.query);
      if (!input.success) return response.status(400).json({ error: 'Filtre de graphique invalide' });

      const { chart, label } = input.data;
      const queries: Record<typeof chart, { sql: string; values: unknown[] }> = {
        dossiersByStatus: {
          sql: 'SELECT id, reference, subject, owner_name, status, submission_deadline, estimated_cost, estimated_currency FROM dossiers WHERE status = $1 ORDER BY submission_deadline NULLS LAST, id DESC LIMIT 100',
          values: [label],
        },
        contractsByState: {
          sql: "SELECT id, contract_number AS reference, subject, holder AS owner_name, state AS status, date_effective AS submission_deadline, amount AS estimated_cost, currency FROM contracts WHERE state = $1 ORDER BY date_effective NULLS LAST, id DESC LIMIT 100",
          values: [label],
        },
        dossiersByExpenseNature: {
          sql: "SELECT id, reference, subject, owner_name, status, submission_deadline, estimated_cost, estimated_currency FROM dossiers WHERE COALESCE(expense_nature, 'Non renseignée') = $1 ORDER BY submission_deadline NULLS LAST, id DESC LIMIT 100",
          values: [label],
        },
        dossiersByProcedure: {
          sql: "SELECT id, reference, subject, owner_name, status, submission_deadline, estimated_cost, estimated_currency FROM dossiers WHERE COALESCE(procedure_type, 'Non renseignée') = $1 ORDER BY submission_deadline NULLS LAST, id DESC LIMIT 100",
          values: [label],
        },
      };
      const query = queries[chart];
      const result = await db.query(query.sql, query.values);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  const listRoute = (table: 'dossiers' | 'contracts', searchColumns: string[]) => async (request: AuthRequest, response: Response, next: NextFunction) => {
    try {
      if (table === 'dossiers') {
        await refreshExpiredDossierStatuses();
      }
      const parsed = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), q: z.string().trim().max(100).optional(), status: z.string().trim().max(40).optional(), export: z.enum(['csv']).optional() }).safeParse(request.query);
      if (!parsed.success) return response.status(400).json({ error: 'Paramètres de recherche invalides' });
      const { page, pageSize, q, status } = parsed.data;
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (!['admin', 'manager'].includes(request.user!.role)) {
        values.push(Number(request.user!.sub));
        conditions.push(table === 'dossiers'
          ? `owner_user_id = $${values.length}`
          : `dossier_id IN (SELECT id FROM dossiers WHERE owner_user_id = $${values.length})`);
      }
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

  app.get('/api/dashboard/deadlines', authenticate, requireRoles('admin', 'manager'), async (_request, response, next) => {
    try {
      const result = await db.query("SELECT id, reference, subject, owner_name, submission_deadline::text AS submission_deadline FROM dossiers WHERE submission_deadline >= LOCALTIMESTAMP AND submission_deadline < CURRENT_DATE + 15 AND status IN ('draft', 'published', 'evaluation') ORDER BY submission_deadline, reference");
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/dossiers', authenticate, listRoute('dossiers', ['reference', 'subject', 'owner_name']));
  app.get('/api/contracts', authenticate, listRoute('contracts', ['contract_number', 'subject', 'holder']));

  app.get('/api/dossier-owners', authenticate, requireRoles('admin', 'manager'), async (_request, response, next) => {
    try {
      const result = await db.query('SELECT id, full_name FROM app_users WHERE is_active = TRUE ORDER BY full_name');
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/dossiers/:id/compliance-recipients', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant invalide' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const dossier = await db.query(
        `SELECT d.owner_name, u.full_name AS owner_full_name, u.email AS owner_email
         FROM dossiers d LEFT JOIN app_users u ON u.id = d.owner_user_id
         WHERE d.id = $1${privileged ? '' : ' AND d.owner_user_id = $2'}`,
        privileged ? [id.data] : [id.data, Number(request.user!.sub)],
      );
      if (!dossier.rows[0]) return response.status(404).json({ error: 'Dossier introuvable' });
      const administrators = await db.query("SELECT full_name, email FROM app_users WHERE role = 'admin' AND is_active = TRUE ORDER BY full_name");
      return response.json({
        data: {
          owner: {
            name: dossier.rows[0].owner_full_name ?? dossier.rows[0].owner_name ?? null,
            email: dossier.rows[0].owner_email ?? null,
          },
          contributors: [],
          administrators: administrators.rows,
        },
      });
    } catch (error) { next(error); }
  });

  app.get('/api/dossiers/:id', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant invalide' });
      await refreshExpiredDossierStatuses();
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const result = await db.query(`SELECT * FROM dossiers WHERE id = $1${privileged ? '' : ' AND owner_user_id = $2'}`, privileged ? [id.data] : [id.data, Number(request.user!.sub)]);
      return result.rows[0] ? response.json({ data: result.rows[0] }) : response.status(404).json({ error: 'Dossier introuvable' });
    } catch (error) { next(error); }
  });

  app.get('/api/dossiers/:id/owner-history', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant du dossier invalide.' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const access = await db.query(`SELECT id FROM dossiers WHERE id = $1${privileged ? '' : ' AND owner_user_id = $2'}`, privileged ? [id.data] : [id.data, Number(request.user!.sub)]);
      if (!access.rows[0]) return response.status(404).json({ error: 'Dossier introuvable.' });
      const history = await db.query(
        `SELECT id, previous_owner_name, new_owner_name, transferred_by_name, transferred_at
         FROM dossier_owner_history WHERE dossier_id = $1 ORDER BY transferred_at DESC, id DESC`,
        [id.data],
      );
      return response.json({ data: history.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/dossiers/:id/tracking', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant invalide' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const access = await db.query(`SELECT id, provisional_bond_return_status FROM dossiers WHERE id = $1${privileged ? '' : ' AND owner_user_id = $2'}`, privileged ? [id.data] : [id.data, Number(request.user!.sub)]);
      if (!access.rows[0]) return response.status(404).json({ error: 'Dossier introuvable' });
      const steps = await db.query(
        `WITH defined_steps(step_key, position) AS (VALUES ${trackingStepKeys.map((_, index) => `($${index + 1}::text, ${index + 1})`).join(', ')})
         SELECT s.step_key, saved.completed_at FROM defined_steps s
         LEFT JOIN dossier_tracking_steps saved ON saved.dossier_id = $${trackingStepKeys.length + 1} AND saved.step_key = s.step_key
         ORDER BY s.position`,
        [...trackingStepKeys, id.data],
      );
      return response.json({ data: steps.rows });
    } catch (error) { next(error); }
  });

  app.put('/api/dossiers/:id/tracking', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      const input = z.object({ steps: z.array(trackingStepSchema).length(trackingStepKeys.length) }).strict().safeParse(request.body);
      if (!id.success) return response.status(400).json({ error: 'L’identifiant du dossier doit être un entier positif.' });
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      if (new Set(input.data.steps.map((step) => step.step_key)).size !== trackingStepKeys.length) return response.status(400).json({ error: 'Le suivi doit contenir une seule date pour chaque étape.' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const access = await db.query(`SELECT id, provisional_bond_return_status FROM dossiers WHERE id = $1${privileged ? '' : ' AND owner_user_id = $2'}`, privileged ? [id.data] : [id.data, Number(request.user!.sub)]);
      if (!access.rows[0]) return response.status(404).json({ error: 'Dossier introuvable' });
      const normalizedSteps = input.data.steps.map((step) => step.step_key !== 'provisional_bond_returned'
        ? step
        : access.rows[0].provisional_bond_return_status === 'returned'
          ? { ...step, completed_at: step.completed_at ?? new Date().toISOString().slice(0, 10) }
          : { ...step, completed_at: null });
      const launchSteps = ['launch_authorized', 'announcement_published'];
      if (normalizedSteps.some((step) => launchSteps.includes(step.step_key) && step.completed_at !== null)) {
        const current = await db.query(
          'SELECT step_key, completed_at FROM dossier_tracking_steps WHERE dossier_id = $1 AND step_key = ANY($2::text[])',
          [id.data, launchSteps],
        );
        const currentDates = new Map(current.rows.map((step) => [step.step_key, step.completed_at ? String(step.completed_at).slice(0, 10) : null]));
        const startsLaunchStep = normalizedSteps.some((step) => launchSteps.includes(step.step_key)
          && step.completed_at !== null
          && step.completed_at !== (currentDates.get(step.step_key) ?? null));
        if (startsLaunchStep) {
          const dossier = await db.query('SELECT launch_specification_status FROM dossiers WHERE id = $1', [id.data]);
          if (dossier.rows[0]?.launch_specification_status !== 'completed') {
            return response.status(409).json({ error: 'Impossible de valider l’étape de lancement : le champ CC pour lancement doit être réglé sur « Effectuée ».', requiresSpecificationCompletion: true });
          }
        }
      }
      await withTransaction(db, async (transaction) => {
        for (const step of normalizedSteps) {
          await transaction.query(
            `INSERT INTO dossier_tracking_steps (dossier_id, step_key, completed_at, updated_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (dossier_id, step_key) DO UPDATE SET completed_at = EXCLUDED.completed_at, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
            [id.data, step.step_key, step.completed_at, Number(request.user!.sub)],
          );
        }
        const returnedDate = normalizedSteps.find((step) => step.step_key === 'provisional_bond_returned')?.completed_at ?? null;
        await transaction.query('UPDATE dossiers SET provisional_bond_return_date = $2 WHERE id = $1', [id.data, returnedDate]);
      });
      return response.json({ data: normalizedSteps });
    } catch (error) { next(error); }
  });

  app.get('/api/dossiers/:id/contracts', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant invalide' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const result = await db.query(
        `SELECT c.* FROM contracts c JOIN dossiers d ON d.id = c.dossier_id WHERE c.dossier_id = $1${privileged ? '' : ' AND d.owner_user_id = $2'} ORDER BY c.created_at DESC, c.id DESC`,
        privileged ? [id.data] : [id.data, Number(request.user!.sub)],
      );
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/contracts/:id', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant invalide' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const result = await db.query(`SELECT c.* FROM contracts c LEFT JOIN dossiers d ON d.id = c.dossier_id WHERE c.id = $1${privileged ? '' : ' AND d.owner_user_id = $2'}`, privileged ? [id.data] : [id.data, Number(request.user!.sub)]);
      return result.rows[0] ? response.json({ data: result.rows[0] }) : response.status(404).json({ error: 'Contrat introuvable' });
    } catch (error) { next(error); }
  });

  app.post('/api/contracts', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = contractSchema.safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      if (input.data.dossier_id === null) return response.status(400).json({ error: 'Un dossier associé est obligatoire pour créer un contrat.' });
      const referenceRules = await getReferenceRules();
      const referenceError = referenceValidationError(input.data.contract_number, referenceRules.masks.contract, null, null, null, referenceRules);
      if (referenceError) return response.status(400).json({ error: referenceError.replace('La référence', 'Le N° contrat') });
      if (!await hasActiveOption('contract_state', input.data.state)) return response.status(400).json({ error: inactiveOptionMessage('contract_state') });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const access = await db.query(`SELECT id FROM dossiers WHERE id = $1${privileged ? '' : ' AND owner_user_id = $2'}`, privileged ? [input.data.dossier_id] : [input.data.dossier_id, Number(request.user!.sub)]);
      if (!access.rows[0]) return response.status(404).json({ error: 'Dossier introuvable' });
      const values = contractFields.map((field) => input.data[field]);
      const result = await db.query(
        `INSERT INTO contracts (${contractFields.join(', ')}) VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
        values,
      );
      if (!result.rows[0]) return response.status(500).json({ error: 'Échec de la création du contrat' });
      await writeAudit(request, 'contracts', String(result.rows[0].id), 'create', `Création du contrat ${result.rows[0].contract_number}`, null, result.rows[0]);
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.post('/api/dossiers', authenticate, requireRoles('admin', 'manager'), async (request: AuthRequest, response, next) => {
    try {
      const input = dossierSchema.safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      if ((input.data.announcement_date !== null || input.data.status === 'published') && input.data.launch_specification_status !== 'completed') {
        return response.status(409).json({ error: 'Impossible de lancer le dossier : le champ CC pour lancement doit être réglé sur « Effectuée ».' });
      }
      const referenceRules = await getReferenceRules();
      const referenceError = referenceValidationError(input.data.reference, referenceRules.masks.dossier, input.data.request_type, input.data.estimated_cost, input.data.committee, referenceRules);
      if (referenceError) return response.status(400).json({ error: referenceError });
      let ownerName: string | null = null;
      if (input.data.owner_user_id !== null) {
        const owner = await db.query('SELECT full_name FROM app_users WHERE id = $1 AND is_active = TRUE', [input.data.owner_user_id]);
        if (!owner.rows[0]) return response.status(400).json({ error: 'Le responsable sélectionné n’est plus actif ou n’existe pas. Choisissez un responsable actif.' });
        ownerName = String(owner.rows[0].full_name);
      }
      for (const [listKey, value] of [['expense_nature', input.data.expense_nature], ['procedure_type', input.data.procedure_type], ['committee', input.data.committee], ['dossier_status', input.data.status]] as const) {
        if (value && !await hasActiveOption(listKey, value)) return response.status(400).json({ error: inactiveOptionMessage(listKey) });
      }
      if (!await isAllowedCurrency(input.data.estimated_currency)) return response.status(400).json({ error: 'La devise choisie est désactivée ou n’existe plus. Choisissez une devise active.' });
      const automaticStatus = calculatedDossierStatus(input.data);
      const statusDiffersFromAutomatic = input.data.status !== automaticStatus;
      if (statusDiffersFromAutomatic && !input.data.confirm_status_override) {
        return response.status(409).json({ error: 'Le statut choisi diffère du statut calculé. Confirmez la dérogation temporaire de 24 heures.', requiresConfirmation: true, automaticStatus });
      }
      const data = {
        ...input.data,
        provisional_bond_return_date: input.data.provisional_bond_return_status === 'returned' ? input.data.provisional_bond_return_date : null,
        owner_name: ownerName,
        status: statusDiffersFromAutomatic ? input.data.status : automaticStatus,
        status_manually_set: statusDiffersFromAutomatic,
        status_manual_until: statusDiffersFromAutomatic ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      };
      const values = dossierFields.map((field) => data[field]);
      const placeholders = values.map((_, index) => `$${index + 1}`);
      const dossier = await withTransaction(db, async (transaction) => {
        const result = await transaction.query(
          `INSERT INTO dossiers (${dossierFields.join(', ')}, status_manual_until) VALUES (${placeholders.join(', ')}, $${values.length + 1}) RETURNING *`,
          [...values, data.status_manual_until],
        );
        if (result.rows[0]) {
          const synchronized = await transaction.query(
            `UPDATE dossiers SET provisional_bond_return_date = CASE WHEN provisional_bond_return_status = 'returned' THEN COALESCE(provisional_bond_return_date, CURRENT_DATE) ELSE NULL END WHERE id = $1 RETURNING *`,
            [result.rows[0].id],
          );
          result.rows[0] = synchronized.rows[0];
          const returnDate = result.rows[0].provisional_bond_return_date ? String(result.rows[0].provisional_bond_return_date).slice(0, 10) : null;
          if (result.rows[0].provisional_bond_return_status === 'returned') {
            await transaction.query(
              `INSERT INTO dossier_tracking_steps (dossier_id, step_key, completed_at, updated_by) VALUES ($1, 'provisional_bond_returned', $2, $3)
               ON CONFLICT (dossier_id, step_key) DO UPDATE SET completed_at = EXCLUDED.completed_at, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
              [result.rows[0].id, returnDate, Number(request.user!.sub)],
            );
          }
        }
        if (result.rows[0]) {
          await writeAudit(request, 'dossiers', String(result.rows[0].id), 'create', `Création du dossier ${result.rows[0].reference}`, null, result.rows[0], transaction);
        }
        if (result.rows[0]?.owner_user_id !== null && result.rows[0]?.owner_user_id !== undefined) {
          await writeDossierOwnerHistory(transaction, Number(result.rows[0].id), null, null, Number(result.rows[0].owner_user_id), String(result.rows[0].owner_name), Number(request.user!.sub));
        }
        return result.rows[0];
      });
      return response.status(201).json({ data: dossier });
    } catch (error) { next(error); }
  });

  app.patch('/api/dossiers/:id', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const ownerEditor = request.user!.role === 'reader';
      if (!privileged && !ownerEditor) return response.status(403).json({ error: 'Accès interdit' });
      const input = dossierSchema.safeParse(request.body);
      if (!id.success) return response.status(400).json({ error: 'L’identifiant du dossier doit être un entier positif.' });
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const before = await db.query(`SELECT * FROM dossiers WHERE id = $1${privileged ? '' : ' AND owner_user_id = $2'}`, privileged ? [id.data] : [id.data, Number(request.user!.sub)]);
      if (!before.rows[0]) return response.status(404).json({ error: 'Dossier introuvable' });
      if (!Object.hasOwn(request.body, 'launch_specification_status')) {
        input.data.launch_specification_status = before.rows[0].launch_specification_status ?? 'in_preparation';
      }
      if (!Object.hasOwn(request.body, 'provisional_bond_return_status')) {
        input.data.provisional_bond_return_status = before.rows[0].provisional_bond_return_status ?? 'not_returned';
      }
      if (!Object.hasOwn(request.body, 'provisional_bond_return_date')) {
        input.data.provisional_bond_return_date = before.rows[0].provisional_bond_return_date
          ? String(before.rows[0].provisional_bond_return_date).slice(0, 10)
          : null;
      }
      const previousAnnouncementDate = before.rows[0].announcement_date ? String(before.rows[0].announcement_date).slice(0, 10) : null;
      const announcementDateChanged = input.data.announcement_date !== previousAnnouncementDate;
      const launchingByDate = announcementDateChanged && input.data.announcement_date !== null;
      const launchingByStatus = input.data.status === 'published' && before.rows[0].status !== 'published';
      if ((launchingByDate || launchingByStatus) && input.data.launch_specification_status !== 'completed') {
        return response.status(409).json({ error: 'Impossible de lancer le dossier : le champ CC pour lancement doit être réglé sur « Effectuée ».', requiresSpecificationCompletion: true });
      }
      if (ownerEditor) {
        const dateTimeFields = new Set(['submission_deadline', 'bid_opening_date']);
        const dateFields = new Set(['announcement_date', 'results_publication_date']);
        const normalizeValue = (field: string, value: unknown) => {
          if (value === null || value === undefined) return null;
          if (dateTimeFields.has(field)) return String(value).replace(' ', 'T').slice(0, 16);
          if (dateFields.has(field)) return String(value).slice(0, 10);
          if (field === 'estimated_cost' || field === 'provisional_bond_amount') return Number(value);
          return value;
        };
        const changedRestrictedField = dossierFields.find((field) => !ownerEditableDossierFields.has(field)
          && normalizeValue(field, input.data[field]) !== normalizeValue(field, before.rows[0][field]));
        if (changedRestrictedField) return response.status(403).json({ error: `Le champ « ${formFieldLabels[changedRestrictedField] ?? changedRestrictedField} » ne peut pas être modifié avec votre rôle. Vous pouvez uniquement corriger les champs de conformité autorisés.` });
      }
      const referenceChanged = input.data.reference !== before.rows[0].reference
        || input.data.request_type !== before.rows[0].request_type
        || input.data.committee !== before.rows[0].committee
        || input.data.estimated_cost !== (before.rows[0].estimated_cost === null ? null : Number(before.rows[0].estimated_cost));
      if (referenceChanged) {
        const referenceRules = await getReferenceRules();
        const referenceError = referenceValidationError(input.data.reference, referenceRules.masks.dossier, input.data.request_type, input.data.estimated_cost, input.data.committee, referenceRules);
        if (referenceError) return response.status(400).json({ error: referenceError });
      }
      let ownerName = input.data.owner_name;
      if (input.data.owner_user_id !== null) {
        if (input.data.owner_user_id === Number(before.rows[0].owner_user_id)
          && (await db.query('SELECT 1 FROM app_users WHERE id = $1 AND is_active = TRUE', [input.data.owner_user_id])).rows[0]) {
          ownerName = String(before.rows[0].owner_name ?? input.data.owner_name ?? '');
        } else {
          const owner = await db.query('SELECT full_name FROM app_users WHERE id = $1 AND is_active = TRUE', [input.data.owner_user_id]);
          if (!owner.rows[0]) return response.status(400).json({ error: 'Le responsable sélectionné n’est plus actif ou n’existe pas. Choisissez un responsable actif.' });
          ownerName = String(owner.rows[0].full_name);
        }
      } else {
        ownerName = input.data.owner_name === (before.rows[0].owner_name ?? null)
          ? before.rows[0].owner_name
          : null;
      }
      for (const [listKey, value, previous] of [
        ['expense_nature', input.data.expense_nature, before.rows[0].expense_nature],
        ['procedure_type', input.data.procedure_type, before.rows[0].procedure_type],
        ['committee', input.data.committee, before.rows[0].committee],
        ['dossier_status', input.data.status, before.rows[0].status],
      ] as const) {
        if (value && value !== previous && !await hasActiveOption(listKey, value)) return response.status(400).json({ error: inactiveOptionMessage(listKey) });
      }
      if (input.data.estimated_currency !== before.rows[0].estimated_currency && !await isAllowedCurrency(input.data.estimated_currency)) return response.status(400).json({ error: 'Devise désactivée' });
      const automaticStatus = calculatedDossierStatus(input.data);
      const statusDiffersFromAutomatic = input.data.status !== automaticStatus;
      const existingOverrideUntil = before.rows[0].status_manual_until ? new Date(String(before.rows[0].status_manual_until)) : null;
      const existingOverrideActive = Boolean(
        before.rows[0].status_manually_set
        && existingOverrideUntil
        && existingOverrideUntil.getTime() > Date.now()
        && input.data.status === before.rows[0].status,
      );
      const existingPermanentManual = Boolean(
        before.rows[0].status_manually_set
        && !existingOverrideUntil
        && input.data.status === before.rows[0].status,
      );
      if (!ownerEditor && statusDiffersFromAutomatic && !input.data.confirm_status_override && !existingOverrideActive && !existingPermanentManual) {
        return response.status(409).json({ error: 'Le statut choisi diffère du statut calculé. Confirmez la dérogation temporaire de 24 heures.', requiresConfirmation: true, automaticStatus });
      }
      const statusManuallySet = statusDiffersFromAutomatic && (existingOverrideActive || existingPermanentManual || input.data.confirm_status_override);
      const status = statusManuallySet ? input.data.status : automaticStatus;
      const data = {
        ...input.data,
        ...(ownerEditor ? Object.fromEntries(dossierFields.filter((field) => !ownerEditableDossierFields.has(field)).map((field) => [field, before.rows[0][field]])) : {}),
        owner_name: ownerName,
        ...(privileged ? {} : { owner_user_id: before.rows[0].owner_user_id, owner_name: before.rows[0].owner_name }),
        provisional_bond_return_date: input.data.provisional_bond_return_status === 'returned' ? input.data.provisional_bond_return_date : null,
        status: ownerEditor ? before.rows[0].status : status,
        status_manually_set: ownerEditor ? before.rows[0].status_manually_set : statusManuallySet,
        status_manual_until: ownerEditor ? before.rows[0].status_manual_until : existingOverrideActive
          ? existingOverrideUntil
          : existingPermanentManual ? null
            : statusManuallySet ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      };
      const assignments = dossierFields.map((field, index) => `${field} = $${index + 2}`);
      const dossier = await withTransaction(db, async (transaction) => {
        const result = await transaction.query(
          `UPDATE dossiers SET ${assignments.join(', ')}, status_manual_until = $${dossierFields.length + 2}, updated_at = NOW() WHERE id = $1 RETURNING *`,
          [id.data, ...dossierFields.map((field) => data[field]), data.status_manual_until],
        );
        if (result.rows[0]) {
          const synchronized = await transaction.query(
            `UPDATE dossiers SET provisional_bond_return_date = CASE WHEN provisional_bond_return_status = 'returned' THEN COALESCE(provisional_bond_return_date, CURRENT_DATE) ELSE NULL END WHERE id = $1 RETURNING *`,
            [id.data],
          );
          result.rows[0] = synchronized.rows[0];
          const previousOwnerId = before.rows[0].owner_user_id === null ? null : Number(before.rows[0].owner_user_id);
          const nextOwnerId = result.rows[0].owner_user_id === null ? null : Number(result.rows[0].owner_user_id);
          const previousOwnerName = before.rows[0].owner_name === null ? null : String(before.rows[0].owner_name);
          const nextOwnerName = result.rows[0].owner_name === null ? null : String(result.rows[0].owner_name);
          if (previousOwnerId !== nextOwnerId) {
            await writeDossierOwnerHistory(transaction, id.data, previousOwnerId, previousOwnerName, nextOwnerId, nextOwnerName, Number(request.user!.sub));
          }
          const returnDate = result.rows[0].provisional_bond_return_date ? String(result.rows[0].provisional_bond_return_date).slice(0, 10) : null;
          await transaction.query(
            `INSERT INTO dossier_tracking_steps (dossier_id, step_key, completed_at, updated_by) VALUES ($1, 'provisional_bond_returned', $2, $3)
             ON CONFLICT (dossier_id, step_key) DO UPDATE SET completed_at = EXCLUDED.completed_at, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
            [id.data, result.rows[0].provisional_bond_return_status === 'returned' ? returnDate : null, Number(request.user!.sub)],
          );
        }
        if (result.rows[0]) {
          await writeAudit(request, 'dossiers', String(id.data), 'update', `Modification du dossier ${result.rows[0].reference}`, before.rows[0] ?? null, result.rows[0], transaction);
        }
        return result.rows[0];
      });
      return dossier ? response.json({ data: dossier }) : response.status(404).json({ error: 'Dossier introuvable' });
    } catch (error) { next(error); }
  });

  app.delete('/api/dossiers/:id', authenticate, requireRoles('admin'), async (request, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant invalide' });
      const result = await db.query('DELETE FROM dossiers WHERE id = $1 RETURNING id', [id.data]);
      return result.rows[0] ? response.status(204).end() : response.status(404).json({ error: 'Dossier introuvable' });
    } catch (error) { next(error); }
  });

  app.patch('/api/contracts/:id', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      const input = contractSchema.safeParse(request.body);
      if (!id.success) return response.status(400).json({ error: 'L’identifiant du contrat doit être un entier positif.' });
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      if (!await hasActiveOption('contract_state', input.data.state)) return response.status(400).json({ error: inactiveOptionMessage('contract_state') });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const before = await db.query(`SELECT c.* FROM contracts c LEFT JOIN dossiers d ON d.id = c.dossier_id WHERE c.id = $1${privileged ? '' : ' AND d.owner_user_id = $2'}`, privileged ? [id.data] : [id.data, Number(request.user!.sub)]);
      if (!before.rows[0]) return response.status(404).json({ error: 'Contrat introuvable' });
      if (input.data.contract_number !== before.rows[0].contract_number) {
        const referenceRules = await getReferenceRules();
        const referenceError = referenceValidationError(input.data.contract_number, referenceRules.masks.contract, null, null, null, referenceRules);
        if (referenceError) return response.status(400).json({ error: referenceError.replace('La référence', 'Le N° contrat') });
      }
      const assignments = contractFields.map((field, index) => `${field} = $${index + 2}`);
      const data = { ...input.data, ...(privileged ? {} : { dossier_id: before.rows[0].dossier_id }) };
      const values = contractFields.map((field) => data[field]);
      const result = await db.query(
        `UPDATE contracts SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id.data, ...values],
      );
      if (result.rows[0]) await writeAudit(request, 'contracts', String(id.data), 'update', `Modification du contrat ${result.rows[0].contract_number}`, before.rows[0] ?? null, result.rows[0]);
      return result.rows[0] ? response.json({ data: result.rows[0] }) : response.status(404).json({ error: 'Contrat introuvable' });
    } catch (error) { next(error); }
  });

  app.patch('/api/contracts/:id/tracking', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      const input = z.object(Object.fromEntries(dateFields.map((field) => [field, z.string().date().nullable().optional()]))).strict().safeParse(request.body);
      if (!id.success) return response.status(400).json({ error: 'L’identifiant du contrat doit être un entier positif.' });
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      if (Object.keys(input.data).length === 0) return response.status(400).json({ error: 'Indiquez au moins une date de suivi à enregistrer.' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const access = await db.query(`SELECT c.id FROM contracts c LEFT JOIN dossiers d ON d.id = c.dossier_id WHERE c.id = $1${privileged ? '' : ' AND d.owner_user_id = $2'}`, privileged ? [id.data] : [id.data, Number(request.user!.sub)]);
      if (!access.rows[0]) return response.status(404).json({ error: 'Contrat introuvable' });
      const fields = Object.keys(input.data) as (typeof dateFields)[number][];
      const assignments = fields.map((field, index) => `${field} = $${index + 2}`);
      const values = fields.map((field) => input.data[field] ?? null);
      const sql = `UPDATE contracts SET ${assignments.join(', ')}, state = CASE WHEN date_archived IS NOT NULL THEN 'archived' WHEN date_effective IS NOT NULL THEN 'active' WHEN date_first_legal_document IS NOT NULL THEN 'in_progress' ELSE 'pending' END WHERE id = $1 RETURNING *`;
      const result = await db.query(sql, [id.data, ...values]);
      return result.rows[0] ? response.json({ data: result.rows[0], derivedState: derivedContractState(result.rows[0]) }) : response.status(404).json({ error: 'Contrat introuvable' });
    } catch (error) { next(error); }
  });

  app.get('/api/calendar/events', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).safeParse(request.query);
      if (!input.success) return response.status(400).json({ error: 'Période de calendrier invalide' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const result = await db.query(
        "SELECT id, reference AS title, bid_opening_date AS event_date, 'opening' AS kind, '#/dossiers/' || id || '/edit' AS link FROM dossiers WHERE bid_opening_date IS NOT NULL AND ($1::date IS NULL OR bid_opening_date >= $1::date) AND ($2::date IS NULL OR bid_opening_date < $2::date + INTERVAL '1 day') AND ($3::boolean OR owner_user_id = $4) UNION ALL SELECT c.id, c.contract_number AS title, c.date_end AS event_date, 'contract_end' AS kind, CASE WHEN c.dossier_id IS NOT NULL THEN '#/dossiers/' || c.dossier_id || '/edit' ELSE '#/contracts/' || c.id || '/edit' END AS link FROM contracts c WHERE c.date_end IS NOT NULL AND ($1::date IS NULL OR c.date_end >= $1::date) AND ($2::date IS NULL OR c.date_end <= $2::date) AND ($3::boolean OR c.dossier_id IN (SELECT id FROM dossiers WHERE owner_user_id = $4)) ORDER BY event_date",
        [input.data.from ?? null, input.data.to ?? null, privileged, Number(request.user!.sub)],
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

  app.post('/api/planning/annual', authenticate, requireRoles('admin', 'manager'), async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({
        fiscal_year: z.number().int().min(2000).max(2200),
        reference: z.string().trim().min(1).max(80),
        subject: z.string().trim().min(1).max(500),
        request_type: z.string().trim().max(120).nullable(),
        committee: z.string().trim().max(160).nullable(),
        procedure_type: z.string().trim().max(120).nullable(),
        estimated_cost: dossierAmountSchema,
        funding_source: z.string().trim().max(160).nullable().default(null),
        estimated_duration_days: z.number().int().nonnegative().nullable().default(null),
        estimated_start_date: z.string().date().nullable().default(null),
        estimated_announcement_date: z.string().date().nullable().default(null),
        estimated_opening_date: z.string().date().nullable().default(null),
      }).strict().safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const referenceRules = await getReferenceRules();
      const referenceError = referenceValidationError(input.data.reference, referenceRules.masks.annual, input.data.request_type, input.data.estimated_cost, input.data.committee, referenceRules);
      if (referenceError) return response.status(400).json({ error: referenceError });
      const fields = Object.keys(input.data);
      const values = Object.values(input.data);
      const result = await db.query(
        `INSERT INTO annual_programs (${fields.join(', ')}) VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
        values,
      );
      return response.status(201).json({ data: result.rows[0] });
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
      const userId = Number(request.user!.sub);
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const [manualResult, dossierResult, todayResult, surveillanceResult, surveillanceRulesResult] = await Promise.all([
        db.query(
          `SELECT r.id, r.title, r.details, r.reminder_at, r.importance, r.lead_minutes, r.is_sent, r.is_read, r.dossier_id, r.visible_until, r.delivery_status, r.delivery_attempts,
             EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = r.user_id) AS has_push_subscription,
             d.reference AS dossier_reference, d.status AS dossier_status, r.created_at, r.created_by_user_id
           FROM user_reminders r
           LEFT JOIN dossiers d ON d.id = r.dossier_id
           WHERE r.user_id = $1 AND (r.visible_until IS NULL OR r.visible_until >= CURRENT_DATE)
           ORDER BY r.reminder_at`,
          [userId],
        ),
        db.query(
          `SELECT d.id, d.reference, d.subject, d.status, d.owner_user_id,
             d.announcement_date::text AS announcement_date,
             d.bid_opening_date::text AS bid_opening_date,
             d.committee_decision_date::text AS committee_decision_date,
             COALESCE(BOOL_OR(s.step_key = 'offers_evaluated' AND s.completed_at IS NOT NULL), FALSE) AS offers_evaluated,
             COALESCE(BOOL_OR(s.step_key = 'provisional_bond_returned' AND s.completed_at IS NOT NULL), FALSE) AS provisional_bond_returned,
             COALESCE(BOOL_OR(s.step_key = 'definitive_bond_requested' AND s.completed_at IS NOT NULL), FALSE) AS definitive_bond_requested,
             COALESCE(BOOL_OR(s.step_key = 'contract_prepared' AND s.completed_at IS NOT NULL), FALSE) AS contract_prepared
           FROM dossiers d
           LEFT JOIN dossier_tracking_steps s ON s.dossier_id = d.id
           WHERE ($1::boolean OR d.owner_user_id = $2)
             AND (d.announcement_date IS NOT NULL OR d.bid_opening_date IS NOT NULL OR d.committee_decision_date IS NOT NULL)
           GROUP BY d.id`,
          [privileged, userId],
        ),
        db.query('SELECT CURRENT_DATE::text AS today'),
        db.query(
          `SELECT e.id, e.rule_key, e.contract_id, e.annual_program_id, e.started_at::text AS started_at, e.completed_at::text AS completed_at,
             e.note, d.id AS dossier_id, d.reference AS dossier_reference, d.subject AS dossier_subject,
             d.owner_user_id, d.committee, d.is_urgent, c.contract_number, c.subject AS contract_subject,
             a.reference AS annual_reference, a.subject AS annual_subject
           FROM surveillance_events e
           LEFT JOIN dossiers d ON d.id = e.dossier_id
           LEFT JOIN contracts c ON c.id = e.contract_id
           LEFT JOIN dossiers cd ON cd.id = c.dossier_id
           LEFT JOIN annual_programs a ON a.id = e.annual_program_id
           WHERE ($1::boolean OR d.owner_user_id = $2 OR cd.owner_user_id = $2 OR e.created_by_user_id = $2)
           ORDER BY e.started_at, e.id`,
          [privileged, userId],
        ),
        db.query('SELECT setting_value FROM application_settings WHERE setting_key = $1', ['surveillance_rules']),
      ]);
      const today = todayResult.rows[0]?.today;
      if (typeof today !== 'string') throw new Error('Impossible de déterminer la date courante de la base de données.');
      const dossiers: BusinessDossier[] = dossierResult.rows.map((row) => ({
        ...row,
        id: Number(row.id),
        owner_user_id: row.owner_user_id === null ? null : Number(row.owner_user_id),
        offers_evaluated: Boolean(row.offers_evaluated),
        provisional_bond_returned: Boolean(row.provisional_bond_returned),
        definitive_bond_requested: Boolean(row.definitive_bond_requested),
        contract_prepared: Boolean(row.contract_prepared),
      }));
      const manual = manualResult.rows.map((row) => ({ ...row, type: 'manual' as const }));
      const business = buildBusinessNotifications(dossiers, today);
      const surveillanceConfiguration = surveillanceRulesSchema.safeParse(surveillanceRulesResult.rows[0]?.setting_value ?? defaultSurveillanceRules);
      const surveillanceRules = surveillanceConfiguration.success ? surveillanceConfiguration.data : defaultSurveillanceRules;
      const todayTime = Date.parse(`${today}T00:00:00.000Z`);
      const surveillance = surveillanceResult.rows.flatMap((event) => {
        if (event.completed_at) return [];
        const rule = surveillanceRules.rules.find((candidate) => candidate.key === event.rule_key && candidate.enabled);
        if (!rule) return [];
        const committee = String(event.committee ?? '');
        const scope: string[] = rule.applicableTo;
        const commissionScopes = scope.filter((value) => ['DAR', 'CRA', 'CAE', 'CME'].includes(value));
        if (!scope.includes('all') && commissionScopes.length > 0 && !commissionScopes.includes(committee)) return [];
        if (scope.includes('urgent') && !Boolean(event.is_urgent)) return [];
        const dueDate = calculateSurveillanceDueDate(String(event.started_at), rule.delay, rule.unit, surveillanceRules.holidays);
        if (!dueDate) return [];
        const dueTime = Date.parse(`${dueDate}T00:00:00.000Z`);
        const daysUntil = Math.round((dueTime - todayTime) / 86_400_000);
        const maxAdvance = surveillanceRules.alertDaysBefore.length ? Math.max(...surveillanceRules.alertDaysBefore) : 0;
        const shouldNotify = daysUntil >= 0
          ? daysUntil <= maxAdvance
          : Math.abs(daysUntil) % surveillanceRules.overdueRepeatDays === 0;
        if (!shouldNotify) return [];
        const reference = String(event.dossier_reference ?? event.contract_number ?? event.annual_reference ?? 'Échéance');
        const subject = String(event.dossier_subject ?? event.contract_subject ?? event.annual_subject ?? '');
        return [{
          id: `surveillance:${event.id}`, type: 'business', rule_key: String(event.rule_key),
          title: `${daysUntil < 0 ? 'Échéance dépassée' : 'Échéance à surveiller'} · ${rule.label} · ${reference}`,
          details: `${subject}${subject ? ' — ' : ''}Départ : ${String(event.started_at).slice(0, 10)} · Échéance : ${dueDate}${event.note ? ` · ${event.note}` : ''}`,
          reminder_at: `${dueDate}T00:00:00`, importance: 'high', is_sent: false, is_read: false,
          dossier_id: event.dossier_id === null ? null : Number(event.dossier_id), contract_id: event.contract_id === null ? null : Number(event.contract_id), annual_program_id: event.annual_program_id === null ? null : Number(event.annual_program_id), dossier_reference: reference, dossier_subject: subject,
        }];
      });
      const data = [...manual, ...business, ...surveillance].sort((left, right) => {
        const byDate = String(left.reminder_at).localeCompare(String(right.reminder_at));
        return byDate || String(left.id).localeCompare(String(right.id));
      });
      return response.json({ data });
    } catch (error) { next(error); }
  });

  app.post('/api/reminders/:id/read', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant de rappel invalide' });
      const result = await db.query('UPDATE user_reminders SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id', [id.data, Number(request.user!.sub)]);
      return result.rows[0] ? response.status(204).end() : response.status(404).json({ error: 'Rappel introuvable' });
    } catch (error) { next(error); }
  });

  app.post('/api/reminders/read-all', authenticate, async (request: AuthRequest, response, next) => {
    try {
      await db.query('UPDATE user_reminders SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [Number(request.user!.sub)]);
      return response.status(204).end();
    } catch (error) { next(error); }
  });

  app.post('/api/reminders', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ title: z.string().trim().min(1).max(160), details: z.string().trim().max(2000).optional(), reminderAt: z.string().datetime(), importance: z.string().trim().min(1).max(40).default('normal'), leadMinutes: z.number().int().min(0).max(10080).default(0), assignToUserId: z.number().int().positive().optional(), assignToUserIds: z.array(z.number().int().positive()).max(100).optional(), visibleUntil: z.string().date().optional() }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      if (!await hasActiveOption('reminder_importance', input.data.importance)) return response.status(400).json({ error: inactiveOptionMessage('reminder_importance') });
      const recipientIds = [...new Set([...(input.data.assignToUserIds ?? []), ...(input.data.assignToUserId ? [input.data.assignToUserId] : [])])];
      if (recipientIds.length && !['admin', 'manager'].includes(request.user!.role)) return response.status(403).json({ error: 'Seuls les gestionnaires peuvent transmettre un rappel' });
      if (recipientIds.length && !input.data.visibleUntil) return response.status(400).json({ error: 'La date de fin d’affichage est obligatoire pour un rappel transmis' });
      if (input.data.visibleUntil && input.data.visibleUntil < new Date().toISOString().slice(0, 10)) return response.status(400).json({ error: 'La date de fin d’affichage doit être aujourd’hui ou ultérieure' });
      const targets = recipientIds.length ? recipientIds : [Number(request.user!.sub)];
      const recipients = await db.query('SELECT id FROM app_users WHERE id = ANY($1::bigint[]) AND is_active = TRUE', [targets]);
      if (recipients.rows.length !== targets.length) return response.status(404).json({ error: 'Un ou plusieurs destinataires sont introuvables ou inactifs' });
      const created = await withTransaction(db, async (transaction) => {
        const reminders = [];
        for (const recipient of recipients.rows) {
          const result = await transaction.query('INSERT INTO user_reminders (user_id, created_by_user_id, title, details, reminder_at, importance, lead_minutes, visible_until) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, user_id, title, details, reminder_at, importance, lead_minutes, visible_until, is_sent, is_read, created_by_user_id', [recipient.id, Number(request.user!.sub), input.data.title, input.data.details ?? null, input.data.reminderAt, input.data.importance, input.data.leadMinutes, input.data.visibleUntil ?? null]);
          reminders.push(result.rows[0]);
        }
        return reminders;
      });
      return response.status(201).json({ data: created });
    } catch (error) { next(error); }
  });

  app.post('/api/reminders/:id/sent', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'Identifiant de rappel invalide' });
      const result = await db.query("UPDATE user_reminders SET is_sent = TRUE, delivery_status = 'sent', delivery_claimed_at = NULL, next_delivery_at = NULL WHERE id = $1 AND user_id = $2 AND delivery_status <> 'sending' RETURNING id", [id.data, Number(request.user!.sub)]);
      return result.rows[0] ? response.status(204).end() : response.status(404).json({ error: 'Rappel introuvable' });
    } catch (error) { next(error); }
  });

  app.get('/api/reminders/assignees', authenticate, requireRoles('admin', 'manager'), async (_request, response, next) => {
    try {
      const result = await db.query('SELECT id, full_name FROM app_users WHERE is_active = TRUE ORDER BY full_name');
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/overtime', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const result = await db.query('SELECT id, employee_label, work_date, start_time, end_time, hours, comment, period FROM overtime_entries WHERE user_id = $1 ORDER BY work_date DESC LIMIT 100', [Number(request.user!.sub)]);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/overtime', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({
        workDate: z.string().date(),
        startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        period: z.string().trim().max(40).optional(),
        comment: z.string().trim().max(500).optional(),
      }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const [startHour, startMinute] = input.data.startTime.split(':').map(Number);
      const [endHour, endMinute] = input.data.endTime.split(':').map(Number);
      const start = startHour * 60 + startMinute;
      let duration = endHour * 60 + endMinute - start;
      if (duration <= 0) duration += 24 * 60;
      const result = await db.query(
        'INSERT INTO overtime_entries (user_id, employee_label, work_date, start_time, end_time, hours, comment, period) SELECT id, full_name, $2, $3, $4, $5, $6, $7 FROM app_users WHERE id = $1 RETURNING id, employee_label, work_date, start_time, end_time, hours, comment, period',
        [Number(request.user!.sub), input.data.workDate, input.data.startTime, input.data.endTime, duration / 60, input.data.comment || null, input.data.period || null],
      );
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.get('/api/leaves', authenticate, async (request: AuthRequest, response, next) => {
    try {
      if (request.query.export === 'csv') {
        const result = await db.query('SELECT employee_label, matricule, service_label, fonction, leave_type, requested_days, holidays, start_date, end_date, balance_before, balance_after, address_during_leave, telephone, status, requested_at FROM leave_requests WHERE user_id = $1 ORDER BY start_date DESC LIMIT 1000', [Number(request.user!.sub)]);
        const csv = [Object.keys(result.rows[0] ?? {}).join(';'), ...result.rows.map((row) => Object.values(row).map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';'))].join('\r\n');
        response.setHeader('Content-Type', 'text/csv; charset=utf-8'); response.setHeader('Content-Disposition', 'attachment; filename="conges.csv"');
        return response.send(`\uFEFF${csv}`);
      }
      const result = await db.query('SELECT id, employee_label, matricule, service_label, fonction, leave_type, start_date, end_date, requested_days, holidays, balance_before, balance_after, address_during_leave, telephone, status, requested_at FROM leave_requests WHERE user_id = $1 ORDER BY start_date DESC LIMIT 100', [Number(request.user!.sub)]);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.get('/api/leaves/balance', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const userId = Number(request.user!.sub);
      const result = await db.query('SELECT (SELECT balance FROM leave_balances WHERE user_id = $1) AS balance, (SELECT service FROM app_users WHERE id = $1) AS service', [userId]);
      return response.json({ balance: result.rows[0]?.balance == null ? null : Number(result.rows[0].balance), service: result.rows[0]?.service ?? '' });
    } catch (error) { next(error); }
  });
  app.put('/api/leaves/balance', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ balance: z.number().min(0).max(99999.99) }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const result = await db.query('INSERT INTO leave_balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = NOW() RETURNING balance', [Number(request.user!.sub), input.data.balance]);
      return response.json({ balance: Number(result.rows[0].balance) });
    } catch (error) { next(error); }
  });
  app.post('/api/leaves', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ leaveType: z.enum(['paid', 'unpaid', 'family', 'authorized', 'compensatory']), startDate: z.string().date(), endDate: z.string().date(), holidays: z.number().int().min(0).max(366), address: z.string().trim().max(500).optional().nullable(), telephone: z.string().trim().max(40).optional().nullable() }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const start = Date.parse(`${input.data.startDate}T00:00:00Z`), end = Date.parse(`${input.data.endDate}T00:00:00Z`);
      const days = (end - start) / 86400000;
      if (!Number.isInteger(days) || days <= 0) return response.status(400).json({ error: 'La date de reprise doit être postérieure à la date de début.' });
      const userId = Number(request.user!.sub);
      const created = await withTransaction(db, async (tx) => {
        const account = await tx.query('SELECT full_name, matricule, service, fonction FROM app_users WHERE id = $1', [userId]);
        if (!account.rows[0]) throw new Error('Compte introuvable.');
        const balanceResult = await tx.query('SELECT balance FROM leave_balances WHERE user_id = $1 FOR UPDATE', [userId]);
        const before = balanceResult.rows[0] ? Number(balanceResult.rows[0].balance) : null;
        const chargedDays = input.data.leaveType === 'paid' ? Math.max(0, days - input.data.holidays) : 0;
        if (input.data.leaveType === 'paid' && before == null) throw new Error('Définissez votre solde de congés avant de créer une demande payée.');
        if (before != null && chargedDays > before) throw new Error('Le solde de congés est insuffisant pour cette demande.');
        const after = before == null ? null : before - chargedDays;
        const row = await tx.query('INSERT INTO leave_requests (user_id, employee_label, matricule, service_label, fonction, leave_type, start_date, end_date, requested_days, holidays, balance_before, balance_after, address_during_leave, telephone) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *', [userId, account.rows[0].full_name, account.rows[0].matricule, account.rows[0].service, account.rows[0].fonction, input.data.leaveType, input.data.startDate, input.data.endDate, days, input.data.holidays, before, after, input.data.address || null, input.data.telephone || null]);
        if (after != null) await tx.query('UPDATE leave_balances SET balance = $2, updated_at = NOW() WHERE user_id = $1', [userId, after]);
        return row.rows[0];
      });
      return response.status(201).json({ data: created });
    } catch (error) { if (error instanceof Error && /solde|Compte introuvable/.test(error.message)) return response.status(409).json({ error: error.message }); next(error); }
  });
  app.delete('/api/leaves/:id', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      if (!id.success) return response.status(400).json({ error: 'L’identifiant de la demande doit être un entier positif.' });
      const deleted = await withTransaction(db, async (tx) => {
        const result = await tx.query('SELECT id, user_id, leave_type, requested_days, holidays, balance_after FROM leave_requests WHERE id = $1 FOR UPDATE', [id.data]);
        const leave = result.rows[0];
        if (!leave) return false;
        if (Number(leave.user_id) !== Number(request.user!.sub)) throw new Error('Vous ne pouvez supprimer que vos propres demandes.');
        if (leave.user_id != null && leave.leave_type === 'paid' && leave.balance_after != null) {
          const current = await tx.query('SELECT balance FROM leave_balances WHERE user_id = $1 FOR UPDATE', [leave.user_id]);
          if (current.rows[0] && Number(current.rows[0].balance) === Number(leave.balance_after)) {
            const restore = Math.max(0, Number(leave.requested_days) - Number(leave.holidays));
            await tx.query('UPDATE leave_balances SET balance = balance + $2, updated_at = NOW() WHERE user_id = $1', [leave.user_id, restore]);
          }
        }
        await tx.query('DELETE FROM leave_requests WHERE id = $1', [id.data]);
        return true;
      });
      return deleted ? response.json({ success: true }) : response.status(404).json({ error: 'Demande de congé introuvable.' });
    } catch (error) { if (error instanceof Error && error.message.startsWith('Vous ne pouvez')) return response.status(403).json({ error: error.message }); next(error); }
  });

  app.get('/api/audit', authenticate, requireRoles('admin'), async (_request, response, next) => {
    try {
      const result = await db.query('SELECT a.id, a.entity_name, a.entity_id, a.action, a.summary, a.old_values, a.new_values, a.changed_at, u.full_name AS actor FROM audit_events a LEFT JOIN app_users u ON u.id = a.user_id ORDER BY a.changed_at DESC LIMIT 100');
      const data = result.rows.map((row) => {
        const oldValues = row.old_values as Record<string, unknown> | null;
        const newValues = row.new_values as Record<string, unknown> | null;
        if (!oldValues || !newValues || typeof oldValues !== 'object' || typeof newValues !== 'object' || Array.isArray(oldValues) || Array.isArray(newValues)) return row;
        const changedKeys = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])]
          .filter((key) => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key]));
        return {
          ...row,
          old_values: Object.fromEntries(changedKeys.filter((key) => Object.hasOwn(oldValues, key)).map((key) => [key, oldValues[key]])),
          new_values: Object.fromEntries(changedKeys.filter((key) => Object.hasOwn(newValues, key)).map((key) => [key, newValues[key]])),
        };
      });
      return response.json({ data });
    } catch (error) { next(error); }
  });

  app.get('/api/users', authenticate, requireRoles('admin'), async (_request, response, next) => {
    try {
      const result = await db.query('SELECT id, email, full_name, role, matricule, service, fonction, tel, is_active, created_at FROM app_users ORDER BY full_name');
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/users', authenticate, requireRoles('admin'), async (request: AuthRequest, response, next) => {
    try {
      const passwordError = passwordPolicyError(request.body?.password);
      if (passwordError) return response.status(400).json({ error: passwordError });
      const input = z.object({
        email: z.string().trim().email().max(200),
        name: z.string().trim().min(1).max(120),
        password: z.string().min(6).max(72),
        role: z.enum(['admin', 'manager', 'reader']),
        matricule: z.string().trim().min(1).max(40),
        service: z.string().trim().max(160).optional().nullable(),
        fonction: z.string().trim().max(160).optional().nullable(),
        tel: z.string().trim().max(40).optional().nullable(),
      }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const passwordHash = await bcrypt.hash(input.data.password, 12);
      const result = await db.query(
        'INSERT INTO app_users (email, full_name, password_hash, role, matricule, service, fonction, tel) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, full_name, role, matricule, service, fonction, tel, is_active, created_at',
        [input.data.email.toLowerCase(), input.data.name, passwordHash, input.data.role, input.data.matricule, input.data.service || null, input.data.fonction || null, input.data.tel || null],
      );
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.patch('/api/users/:id', authenticate, requireRoles('admin'), async (request: AuthRequest, response, next) => {
    try {
      const passwordError = passwordPolicyError(request.body?.password);
      if (passwordError) return response.status(400).json({ error: passwordError });
      const id = z.coerce.number().int().positive().safeParse(request.params.id);
      const input = z.object({
        email: z.string().trim().email().max(200),
        name: z.string().trim().min(1).max(120),
        password: z.string().min(6).max(72).optional(),
        role: z.enum(['admin', 'manager', 'reader']),
        matricule: z.string().trim().min(1).max(40),
        service: z.string().trim().max(160).optional().nullable(),
        fonction: z.string().trim().max(160).optional().nullable(),
        tel: z.string().trim().max(40).optional().nullable(),
      }).safeParse(request.body);
      if (!id.success) return response.status(400).json({ error: 'L’identifiant du compte doit être un entier positif.' });
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const before = await db.query('SELECT role FROM app_users WHERE id = $1', [id.data]);
      if (!before.rows[0]) return response.status(404).json({ error: 'Compte introuvable' });
      const passwordHash = input.data.password ? await bcrypt.hash(input.data.password, 12) : null;
      const result = await db.query(
        'UPDATE app_users SET email = $2, full_name = $3, password_hash = COALESCE($4, password_hash), role = $5, matricule = $6, service = $7, fonction = $8, tel = $9 WHERE id = $1 RETURNING id, email, full_name, role, matricule, service, fonction, tel, is_active, created_at',
        [id.data, input.data.email.toLowerCase(), input.data.name, passwordHash, input.data.role, input.data.matricule, input.data.service || null, input.data.fonction || null, input.data.tel || null],
      );
      if (!result.rows[0]) return response.status(404).json({ error: 'Compte introuvable' });
      if (passwordHash || before.rows[0].role !== input.data.role) {
        await db.query('UPDATE refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1', [id.data]);
      }
      return response.json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.get('/api/clarifications', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ q: z.string().trim().max(100).optional(), dossierId: z.coerce.number().int().positive().optional() }).safeParse(request.query);
      if (!input.success) return response.status(400).json({ error: 'Recherche invalide' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const result = await db.query('SELECT c.id, c.dossier_id, d.reference AS dossier_reference, c.subject, c.received_at, c.response, c.sent_at FROM clarification_requests c JOIN dossiers d ON d.id = c.dossier_id WHERE ($1::text IS NULL OR d.reference ILIKE $1 OR c.subject ILIKE $1) AND ($2::bigint IS NULL OR c.dossier_id = $2) AND ($3::boolean OR d.owner_user_id = $4) ORDER BY c.created_at DESC LIMIT 100', [input.data.q ? `%${input.data.q}%` : null, input.data.dossierId ?? null, privileged, Number(request.user!.sub)]);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/clarifications', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ dossierId: z.coerce.number().int().positive(), subject: z.string().trim().min(1).max(500), receivedAt: z.string().date().nullable().optional(), response: z.string().trim().max(4000).optional(), sentAt: z.string().date().nullable().optional() }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const access = await db.query(`SELECT id FROM dossiers WHERE id = $1${privileged ? '' : ' AND owner_user_id = $2'}`, privileged ? [input.data.dossierId] : [input.data.dossierId, Number(request.user!.sub)]);
      if (!access.rows[0]) return response.status(404).json({ error: 'Dossier introuvable' });
      const result = await db.query('INSERT INTO clarification_requests (dossier_id, subject, received_at, response, sent_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, dossier_id, subject, received_at, response, sent_at', [input.data.dossierId, input.data.subject, input.data.receivedAt ?? null, input.data.response ?? null, input.data.sentAt ?? null]);
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.get('/api/notes', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const dossierId = z.coerce.number().int().positive().optional().safeParse(request.query.dossierId);
      if (!dossierId.success) return response.status(400).json({ error: 'Identifiant de dossier invalide' });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const result = await db.query('SELECT n.id, n.dossier_id, d.reference AS dossier_reference, n.body, u.full_name AS author, n.created_at FROM dossier_notes n JOIN dossiers d ON d.id = n.dossier_id LEFT JOIN app_users u ON u.id = n.author_id WHERE ($1::bigint IS NULL OR n.dossier_id = $1) AND ($2::boolean OR d.owner_user_id = $3) ORDER BY n.created_at DESC LIMIT 100', [dossierId.data ?? null, privileged, Number(request.user!.sub)]);
      return response.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/notes', authenticate, async (request: AuthRequest, response, next) => {
    try {
      const input = z.object({ dossierId: z.coerce.number().int().positive(), body: z.string().trim().min(1).max(4000) }).safeParse(request.body);
      if (!input.success) return response.status(400).json({ error: formValidationMessage(input.error) });
      const privileged = ['admin', 'manager'].includes(request.user!.role);
      const access = await db.query(`SELECT id FROM dossiers WHERE id = $1${privileged ? '' : ' AND owner_user_id = $2'}`, privileged ? [input.data.dossierId] : [input.data.dossierId, Number(request.user!.sub)]);
      if (!access.rows[0]) return response.status(404).json({ error: 'Dossier introuvable' });
      const result = await db.query('INSERT INTO dossier_notes (dossier_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, dossier_id, body, created_at', [input.data.dossierId, Number(request.user!.sub), input.data.body]);
      return response.status(201).json({ data: result.rows[0] });
    } catch (error) { next(error); }
  });

  app.use((error: unknown, request: Request, response: Response, next: NextFunction) => {
    void next;
    if (!process.env.DATABASE_URL) {
      return response.status(503).json({ error: 'Base de données non configurée. Définissez DATABASE_URL puis exécutez npm run db:migrate et npm run seed.' });
    }
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
    const constraint = typeof error === 'object' && error !== null && 'constraint' in error && typeof error.constraint === 'string'
      ? error.constraint
      : undefined;
    if (code === '23505') {
      const duplicateMessages: Record<string, string> = {
        contracts_contract_number_key: 'Ce numéro de contrat est déjà utilisé. Choisissez un autre numéro.',
        dossiers_reference_key: 'Cette référence de dossier est déjà utilisée. Choisissez une autre référence.',
        app_users_email_key: 'Cette adresse e-mail est déjà utilisée par un autre compte.',
        app_users_matricule_unique_idx: 'Ce matricule est déjà utilisé par un autre compte.',
        configurable_options_list_key_option_value_key: 'Cette valeur existe déjà dans la liste choisie.',
        annual_programs_fiscal_year_reference_key: 'Cette référence existe déjà pour l’année du plan indiquée.',
      };
      if (constraint && duplicateMessages[constraint]) return response.status(409).json({ error: duplicateMessages[constraint] });
    }
    if (code === '42703' || code === '42P01') {
      console.error('[api] Database schema is missing an expected column or table', { method: request.method, path: request.path, code });
      return response.status(503).json({ error: 'Le schéma de la base doit être mis à jour. Exécutez npm run db:migrate:dossier-detail avec la base configurée.' });
    }
    console.error('[api] Unhandled request error', { method: request.method, path: request.path, code });
    return response.status(500).json({ error: 'Une erreur inattendue est survenue. Réessayez. Si le problème persiste, contactez un administrateur.' });
  });
  return app;
}
