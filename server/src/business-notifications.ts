export type BusinessNotificationRule =
  | 'publication'
  | 'bid_opening'
  | 'offers_evaluation'
  | 'provisional_bond_return'
  | 'definitive_bond_request'
  | 'contract_preparation';

export type BusinessNotification = {
  id: string;
  type: 'business';
  rule_key: BusinessNotificationRule;
  title: string;
  details: string;
  reminder_at: string;
  importance: 'high';
  is_sent: false;
  is_read: false;
  dossier_id: number;
  dossier_reference: string;
  dossier_subject: string;
};

export type BusinessDossier = {
  id: number;
  reference: string;
  subject: string;
  status: string;
  owner_user_id: number | null;
  announcement_date: string | null;
  bid_opening_date: string | null;
  committee_decision_date: string | null;
  offers_evaluated: boolean;
  provisional_bond_returned: boolean;
  definitive_bond_requested: boolean;
  contract_prepared: boolean;
};

const rules: Record<BusinessNotificationRule, { title: string; daysBefore?: number; daysAfter?: number; completedField?: keyof BusinessDossier; awardedOnly?: boolean }> = {
  publication: { title: 'Publication à préparer', daysBefore: 2 },
  bid_opening: { title: 'Ouverture des plis à préparer', daysBefore: 2 },
  offers_evaluation: { title: 'Évaluation des offres à effectuer', daysAfter: 2, completedField: 'offers_evaluated' },
  provisional_bond_return: { title: 'Restitution de la caution provisoire à effectuer', daysAfter: 2, completedField: 'provisional_bond_returned' },
  definitive_bond_request: { title: 'Demande de la caution définitive à effectuer', daysAfter: 2, completedField: 'definitive_bond_requested', awardedOnly: true },
  contract_preparation: { title: 'Préparation du contrat à effectuer', daysAfter: 3, completedField: 'contract_prepared', awardedOnly: true },
};

function parseCalendarDate(value: string | null) {
  const date = value?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

function moveBusinessDays(value: string, offset: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const direction = Math.sign(offset);
  let remaining = Math.abs(offset);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function createNotification(
  dossier: BusinessDossier,
  ruleKey: BusinessNotificationRule,
  triggerDate: string,
  eventDate: string,
): BusinessNotification {
  const rule = rules[ruleKey];
  return {
    id: `business:${ruleKey}:${dossier.id}`,
    type: 'business',
    rule_key: ruleKey,
    title: `${rule.title} · ${dossier.reference}`,
    details: `${dossier.subject} — échéance : ${eventDate.split('-').reverse().join('/')}`,
    reminder_at: `${triggerDate}T00:00:00`,
    importance: 'high',
    is_sent: false,
    is_read: false,
    dossier_id: dossier.id,
    dossier_reference: dossier.reference,
    dossier_subject: dossier.subject,
  };
}

export function buildBusinessNotifications(dossiers: BusinessDossier[], today: string) {
  const notifications: BusinessNotification[] = [];
  for (const dossier of dossiers) {
    for (const [ruleKey, rule] of Object.entries(rules) as [BusinessNotificationRule, typeof rules[BusinessNotificationRule]][]) {
      if (rule.awardedOnly && dossier.status !== 'awarded') continue;
      if (rule.completedField && dossier[rule.completedField]) continue;

      const sourceDate = rule.daysBefore === undefined
        ? dossier.committee_decision_date
        : ruleKey === 'publication' ? dossier.announcement_date : dossier.bid_opening_date;
      const eventDate = parseCalendarDate(
        ruleKey === 'offers_evaluation' ? dossier.bid_opening_date : sourceDate,
      );
      if (!eventDate) continue;

      const triggerDate = rule.daysBefore === undefined
        ? moveBusinessDays(eventDate, rule.daysAfter! + 1)
        : moveBusinessDays(eventDate, -rule.daysBefore);
      const active = rule.daysBefore === undefined
        ? triggerDate <= today
        : triggerDate <= today && today <= eventDate;
      if (!active) continue;

      notifications.push(createNotification(dossier, ruleKey, triggerDate, eventDate));
    }
  }
  return notifications.sort((left, right) => left.reminder_at.localeCompare(right.reminder_at) || left.id.localeCompare(right.id));
}
