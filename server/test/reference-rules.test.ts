import { defaultReferenceRules, expectedCommission, formatReference, referenceValidationError } from '../src/reference-rules';

describe('reference masks and commission rules', () => {
  it('assigns the configured study commissions across inclusive thresholds', () => {
    expect(expectedCommission('Etude', 14_999, defaultReferenceRules)).toEqual({ commission: 'CRA', prefix: 'AG' });
    expect(expectedCommission('Etude', 15_000, defaultReferenceRules)).toEqual({ commission: 'CAE', prefix: 'AF' });
    expect(expectedCommission('Étude', 200_000, defaultReferenceRules)).toEqual({ commission: 'CME', prefix: 'AE' });
  });

  it('assigns services and goods without overlapping threshold boundaries', () => {
    expect(expectedCommission('Services', 19_999, defaultReferenceRules)).toBeNull();
    expect(expectedCommission('Fourniture de biens, Equipement', 20_000, defaultReferenceRules)).toEqual({ commission: 'CRA', prefix: 'AG' });
    expect(expectedCommission('Services', 200_000, defaultReferenceRules)).toEqual({ commission: 'CAE', prefix: 'AF' });
    expect(expectedCommission('Services', 2_000_000, defaultReferenceRules)).toEqual({ commission: 'CME', prefix: 'AE' });
    expect(expectedCommission('Fourniture de biens, d’équipement et de services', 20_000, defaultReferenceRules))
      .toEqual({ commission: 'CRA', prefix: 'AG' });
  });

  it('formats typed characters and enforces the rule-derived prefix', () => {
    expect(formatReference('ae 26 3 2026', defaultReferenceRules.masks.dossier, 'AG')).toBe('AG.26.3.2026');
    expect(formatReference('26 3 2026', defaultReferenceRules.masks.contract, 'AP')).toBe('AP.26.3.2026');
  });

  it('rejects a mismatched commission and reference prefix', () => {
    expect(referenceValidationError('AF.26.3.2026', defaultReferenceRules.masks.dossier, 'Etude', 10_000, 'CAE', defaultReferenceRules))
      .toContain('commission attendue est CRA');
    expect(referenceValidationError('AF.26.3.2026', defaultReferenceRules.masks.dossier, 'Etude', 10_000, 'CRA', defaultReferenceRules))
      .toContain('préfixe attendu');
  });
});
