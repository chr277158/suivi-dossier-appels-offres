import { buildBusinessNotifications, type BusinessDossier } from '../src/business-notifications';

const dossier = (overrides: Partial<BusinessDossier> = {}): BusinessDossier => ({
  id: 12,
  reference: 'AO-2026-012',
  subject: 'Maintenance',
  status: 'published',
  owner_user_id: 7,
  announcement_date: null,
  bid_opening_date: null,
  committee_decision_date: null,
  offers_evaluated: false,
  provisional_bond_returned: false,
  definitive_bond_requested: false,
  contract_prepared: false,
  ...overrides,
});

describe('business notifications', () => {
  it('alerts two working days before publication and keeps it active through the event date', () => {
    const record = dossier({ announcement_date: '2026-10-22' });
    expect(buildBusinessNotifications([record], '2026-10-19')).toHaveLength(0);
    expect(buildBusinessNotifications([record], '2026-10-20')).toMatchObject([
      { id: 'business:publication:12', reminder_at: '2026-10-20T00:00:00' },
    ]);
    expect(buildBusinessNotifications([record], '2026-10-22')).toHaveLength(1);
    expect(buildBusinessNotifications([record], '2026-10-23')).toHaveLength(0);
  });

  it('skips weekends when calculating an alert before an event', () => {
    const record = dossier({ announcement_date: '2026-10-26' });
    expect(buildBusinessNotifications([record], '2026-10-21')).toHaveLength(0);
    expect(buildBusinessNotifications([record], '2026-10-22')).toHaveLength(1);
  });

  it('alerts after more than two working days since the opening and stops when evaluated', () => {
    const record = dossier({ bid_opening_date: '2026-10-16T10:00' });
    expect(buildBusinessNotifications([record], '2026-10-20')).toHaveLength(0);
    expect(buildBusinessNotifications([record], '2026-10-21')).toMatchObject([
      { rule_key: 'offers_evaluation', reminder_at: '2026-10-21T00:00:00' },
    ]);
    expect(buildBusinessNotifications([dossier({ ...record, offers_evaluated: true })], '2026-10-21')).toHaveLength(0);
  });

  it('uses a three-working-day threshold for provisional-bond return', () => {
    const record = dossier({ committee_decision_date: '2026-10-16' });
    expect(buildBusinessNotifications([record], '2026-10-20')).toHaveLength(0);
    expect(buildBusinessNotifications([record], '2026-10-21')).toMatchObject([
      { rule_key: 'provisional_bond_return' },
    ]);
  });

  it('requires an awarded status and applies the exact greater-than thresholds', () => {
    const record = dossier({ status: 'awarded', committee_decision_date: '2026-10-16' });
    expect(buildBusinessNotifications([record], '2026-10-21').map(({ rule_key }) => rule_key))
      .toEqual(['definitive_bond_request', 'provisional_bond_return']);
    expect(buildBusinessNotifications([record], '2026-10-22').map(({ rule_key }) => rule_key))
      .toEqual(['definitive_bond_request', 'provisional_bond_return', 'contract_preparation']);
    expect(buildBusinessNotifications([dossier({ ...record, definitive_bond_requested: true })], '2026-10-21')
      .map(({ rule_key }) => rule_key)).toEqual(['provisional_bond_return']);
  });

  it('rejects malformed dates and keeps overdue alerts active until completion', () => {
    expect(buildBusinessNotifications([dossier({ announcement_date: '2026-02-30' })], '2026-02-25')).toHaveLength(0);
    expect(buildBusinessNotifications([dossier({ bid_opening_date: '2026-10-16T10:00' })], '2026-10-22'))
      .toMatchObject([{ rule_key: 'offers_evaluation' }]);
  });
});
