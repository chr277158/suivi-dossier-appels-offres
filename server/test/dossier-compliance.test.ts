import { defaultReferenceRules } from '../src/reference-rules';
import { verifierDossier, verifierDossiers, type ComplianceDossier } from '../../client/src/dossier-compliance';
import { defaultReferenceRules as clientReferenceRules, suggestDossierReference } from '../../client/src/reference-rules';

const dossier = (overrides: Partial<ComplianceDossier> = {}): ComplianceDossier => ({
  id: 1,
  reference: 'AG.26.3.0001',
  subject: 'Étude',
  estimated_cost: 10_000,
  estimated_currency: 'TND',
  request_type: 'Étude',
  committee: 'CRA',
  owner_name: 'Responsable',
  owner_user_id: 7,
  announcement_date: '2026-01-01',
  submission_deadline: '2026-01-08T12:00',
  bid_opening_date: '2026-01-09T10:00',
  results_publication_date: '2026-01-30',
  is_urgent: false,
  via_tuneps: false,
  status: 'published',
  ...overrides,
});

describe('dossier compliance findings', () => {
  it('suggests the next sequential dossier number for the current year across commission prefixes', () => {
    expect(suggestDossierReference([
      'AG.26.3.0001',
      'AF.26.3.0004',
      'AE.25.3.0009',
    ], 'Étude', 10_000, clientReferenceRules, 2026)).toBe('AG.26.3.0002');
    expect(suggestDossierReference([], 'Étude', 15_000, clientReferenceRules, 2026)).toBe('AF.26.3.0001');
  });

  it('suggests the first missing sequential number instead of incrementing the largest number', () => {
    expect(suggestDossierReference([
      'AG.26.3.0001',
      'AF.26.3.0002',
      'AE.26.3.0003',
      'AG.26.3.0152',
      'AF.26.3.2510',
    ], 'Étude', 10_000, clientReferenceRules, 2026)).toBe('AG.26.3.0004');
  });

  it('does not suggest a reference without a commission or after the sequence is exhausted', () => {
    expect(suggestDossierReference([], 'Services', 10_000, clientReferenceRules, 2026)).toBeNull();
    const assignedReferences = Array.from({ length: 9999 }, (_, index) =>
      `AG.26.3.${String(index + 1).padStart(4, '0')}`);
    expect(suggestDossierReference(assignedReferences, 'Étude', 10_000, clientReferenceRules, 2026)).toBeNull();
  });

  it('accepts exact commission and reference prefix threshold boundaries', () => {
    expect(verifierDossier(dossier({
      estimated_cost: 15_000, reference: 'AF.26.3.0001', committee: 'CAE',
      announcement_date: null, submission_deadline: null, bid_opening_date: null, results_publication_date: null,
    }))).toEqual([]);
    expect(verifierDossier(dossier({
      estimated_cost: 200_000, reference: 'AE.26.3.0001', committee: 'CME',
      announcement_date: null, submission_deadline: null, bid_opening_date: null, results_publication_date: null,
    }))).toEqual([]);
  });

  it('detects commission, prefix, and duplicate numbers across different prefixes in the same year', () => {
    const rows = verifierDossiers([
      dossier({ id: 1, reference: 'AG.26.3.0002' }),
      dossier({ id: 2, reference: 'AF.26.3.0002', estimated_cost: 10_000, committee: 'CAE' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1].findings.map(({ key }) => key)).toEqual(expect.arrayContaining(['commission', 'prefix', 'duplicate-26-0002']));
    expect(rows[0].findings.find(({ key }) => key === 'duplicate-26-0002')?.message)
      .toContain("pour l'année 2026");
  });

  it('does not treat the same dossier number in different years as a duplicate', () => {
    const rows = verifierDossiers([
      dossier({ id: 1, reference: 'AG.26.3.0002' }),
      dossier({ id: 2, reference: 'AF.27.3.0002', estimated_cost: 10_000, committee: 'CAE' }),
    ]);
    expect(rows.every(({ findings }) => findings.every(({ key }) => !key.startsWith('duplicate-')))).toBe(true);
  });

  it('applies urgent minimum competition periods and TUNEPS opening exemption', () => {
    const shortCompetition = dossier({ submission_deadline: '2026-01-05T12:00', is_urgent: false });
    expect(verifierDossier(shortCompetition, defaultReferenceRules).map(({ key }) => key)).toContain('competition-delay');
    expect(verifierDossier({ ...shortCompetition, is_urgent: true }).map(({ key }) => key)).not.toContain('competition-delay');
    const lateOpening = dossier({ bid_opening_date: '2026-01-13T12:00' });
    expect(verifierDossier(lateOpening).map(({ key }) => key)).toContain('opening-delay');
    expect(verifierDossier({ ...lateOpening, via_tuneps: true }).map(({ key }) => key)).not.toContain('opening-delay');
  });

  it('applies the correct CAE and CME competition thresholds', () => {
    const cae = dossier({
      estimated_cost: 15_000, committee: 'CAE', reference: 'AF.26.3.0001',
      submission_deadline: '2026-01-10T12:00',
    });
    expect(verifierDossier(cae).map(({ key }) => key)).toContain('competition-delay');
    expect(verifierDossier({ ...cae, is_urgent: true }).map(({ key }) => key)).not.toContain('competition-delay');

    const cme = dossier({
      estimated_cost: 200_000, committee: 'CME', reference: 'AE.26.3.0001',
      submission_deadline: '2026-01-30T12:00',
    });
    expect(verifierDossier(cme).map(({ key }) => key)).toContain('competition-delay');
    expect(verifierDossier({ ...cme, is_urgent: true }).map(({ key }) => key)).not.toContain('competition-delay');
  });

  it('checks the evaluation maximum by commission', () => {
    const late = dossier({ results_publication_date: '2026-03-15' });
    expect(verifierDossier(late).map(({ key }) => key)).toContain('evaluation-delay');
    expect(verifierDossier({ ...late, estimated_cost: 200_000, committee: 'CME', reference: 'AE.26.3.0001', results_publication_date: '2026-03-10' }).map(({ key }) => key)).not.toContain('evaluation-delay');
  });
});
