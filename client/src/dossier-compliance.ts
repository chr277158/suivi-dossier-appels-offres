import { defaultReferenceRules, expectedCommission, type ReferenceRules } from './reference-rules';

export type ComplianceDossier = {
  id: number;
  reference: string;
  subject: string;
  estimated_cost: number | null;
  estimated_currency: string;
  request_type: string | null;
  committee: string | null;
  owner_name: string | null;
  owner_user_id: number | null;
  launch_specification_status?: 'completed' | 'in_preparation';
  announcement_date: string | null;
  submission_deadline: string | null;
  bid_opening_date: string | null;
  results_publication_date: string | null;
  is_urgent?: boolean;
  via_tuneps?: boolean;
  status?: string;
};

export type ComplianceFinding = { key: string; message: string };

function day(value: string | null | undefined) {
  if (!value) return null;
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

function elapsedDays(start: string | null, end: string | null) {
  const startDay = day(start);
  const endDay = day(end);
  return startDay === null || endDay === null ? null : Math.round((endDay - startDay) / 86_400_000);
}

export function dossierNumber(reference: string) {
  return reference.match(/(\d{4})$/)?.[1] ?? null;
}

function dossierReferenceParts(reference: string) {
  const match = reference.match(/^[A-Z]{2}\.(\d{2})\.3\.(\d{4})$/);
  return match ? { year: match[1], number: match[2] } : null;
}

export function verifierDossier(
  dossier: ComplianceDossier,
  rules: ReferenceRules = defaultReferenceRules,
  duplicateNumbers: ReadonlySet<string> = new Set(),
): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];
  const requestType = dossier.request_type ?? '';
  const budget = dossier.estimated_cost === null ? null : Number(dossier.estimated_cost);
  const expected = budget === null ? null : expectedCommission(requestType, budget, rules);

  if (!requestType.trim()) {
    findings.push({ key: 'missing-request-type', message: 'Le type de prestation est requis pour déterminer la commission réglementaire.' });
  }
  if (budget === null) {
    findings.push({ key: 'missing-budget', message: 'Le budget est requis pour déterminer la commission réglementaire.' });
  } else if (requestType && budget !== null && !expected) {
    findings.push({ key: 'commission-undefined', message: 'Aucune commission n’est définie pour ce type de prestation et ce budget.' });
  } else if (expected) {
    if (dossier.committee?.trim().toUpperCase() !== expected.commission) {
      findings.push({ key: 'commission', message: `Commission attendue : ${expected.commission}.` });
    }
    if (!dossier.reference.startsWith(`${expected.prefix}.`)) {
      findings.push({ key: 'prefix', message: `Préfixe de référence attendu : ${expected.prefix}.` });
    }
  }

  const referenceParts = dossierReferenceParts(dossier.reference);
  const duplicateKey = referenceParts ? `${referenceParts.year}-${referenceParts.number}` : null;
  if (referenceParts && duplicateKey && duplicateNumbers.has(duplicateKey)) {
    findings.push({
      key: `duplicate-${duplicateKey}`,
      message: `Le numéro de dossier ${referenceParts.number} est partagé par plusieurs références pour l'année 20${referenceParts.year}.`,
    });
  }

  const announcementDay = day(dossier.announcement_date);
  const today = day(new Date().toISOString());
  const hasLaunched = dossier.status === 'published' || (announcementDay !== null && today !== null && announcementDay <= today);
  if (hasLaunched && dossier.launch_specification_status !== 'completed') {
    findings.push({ key: 'launch-without-specification', message: 'Dossier lancé sans cahier des charges effectué.' });
  }

  if (!expected || dossier.status === 'cancelled') return findings;
  const minimumCompetitionDays = expected.commission === 'CRA' ? (dossier.is_urgent ? 1 : 7)
    : expected.commission === 'CAE' ? (dossier.is_urgent ? 3 : 10)
      : dossier.is_urgent ? 15 : 30;
  const competitionDays = elapsedDays(dossier.announcement_date, dossier.submission_deadline);
  if (competitionDays !== null && competitionDays < minimumCompetitionDays) {
    findings.push({
      key: 'competition-delay',
      message: `Le délai de mise en concurrence est de ${competitionDays} jour(s), inférieur au minimum de ${minimumCompetitionDays} jour(s)${dossier.is_urgent ? ' applicable en urgence' : ''}.`,
    });
  }

  if (!dossier.via_tuneps) {
    const openingDays = elapsedDays(dossier.submission_deadline, dossier.bid_opening_date);
    if (openingDays !== null && openingDays > 3) {
      findings.push({ key: 'opening-delay', message: `L’ouverture intervient ${openingDays} jour(s) après la date limite; le maximum hors TUNEPS est de 3 jours.` });
    }
  }

  const evaluationDays = elapsedDays(dossier.bid_opening_date, dossier.results_publication_date);
  const maximumEvaluationDays = expected.commission === 'CME' ? 60 : 30;
  if (evaluationDays !== null && evaluationDays > maximumEvaluationDays) {
    findings.push({ key: 'evaluation-delay', message: `La publication des résultats intervient ${evaluationDays} jour(s) après l’ouverture; le maximum est de ${maximumEvaluationDays} jours.` });
  }
  return findings;
}

export function verifierDossiers(dossiers: ComplianceDossier[], rules: ReferenceRules = defaultReferenceRules) {
  const counts = new Map<string, number>();
  for (const dossier of dossiers) {
    const parts = dossierReferenceParts(dossier.reference);
    const key = parts ? `${parts.year}-${parts.number}` : null;
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  return dossiers.map((dossier) => ({
    dossier,
    findings: verifierDossier(dossier, rules, duplicates),
  })).filter((result) => result.findings.length > 0);
}
