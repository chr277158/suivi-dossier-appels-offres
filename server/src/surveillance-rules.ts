import { z } from 'zod';

export const surveillanceRulesSchema = z.object({
  version: z.string().min(1).max(80),
  alertDaysBefore: z.array(z.number().int().min(0).max(365)).max(10),
  overdueRepeatDays: z.number().int().min(1).max(90),
  holidays: z.array(z.string().date()).max(1000),
  rules: z.array(z.object({
    key: z.string().regex(/^[a-z0-9_]+$/).max(60),
    label: z.string().trim().min(1).max(160),
    sourceField: z.string().trim().min(1).max(80),
    sourceLabel: z.string().trim().min(1).max(160),
    delay: z.number().int().min(0).max(3650),
    unit: z.enum(['calendar_days', 'business_days', 'calendar_months']),
    enabled: z.boolean(),
    applicableTo: z.array(z.enum(['all', 'DAR', 'CRA', 'CAE', 'CME', 'urgent'])).min(1),
  })).min(1).max(60),
}).strict();

export type SurveillanceRules = z.infer<typeof surveillanceRulesSchema>;
export type SurveillanceRule = SurveillanceRules['rules'][number];

export const defaultSurveillanceRules: SurveillanceRules = {
  version: 'Manuel Achats GCT 29-12-2022',
  alertDaysBefore: [7, 3, 1],
  overdueRepeatDays: 1,
  holidays: [],
  rules: [
    { key: 'annual_needs', label: 'Date limite de transmission des besoins annuels (fin novembre)', sourceField: 'annual_needs_deadline', sourceLabel: 'Date limite réglementaire du 30 novembre', delay: 0, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'annual_publication', label: 'Date limite de publication du plan annuel (fin février)', sourceField: 'annual_publication_deadline', sourceLabel: 'Date limite réglementaire de fin février', delay: 0, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'specification_approval', label: 'Approbation du cahier des charges', sourceField: 'dossier_received_complete', sourceLabel: 'Réception du dossier complet', delay: 30, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'missing_documents', label: 'Régularisation des pièces administratives manquantes', sourceField: 'document_regularization_request', sourceLabel: 'Demande de régularisation', delay: 5, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'quote_deadline', label: 'Délai de consultation sur devis', sourceField: 'invitation_sent', sourceLabel: 'Envoi des invitations', delay: 5, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'extended_consultation_deadline', label: 'Délai de consultation élargie', sourceField: 'invitation_sent', sourceLabel: 'Envoi des invitations', delay: 10, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'dar_competition', label: 'Délai de mise en concurrence DAR', sourceField: 'announcement_date', sourceLabel: 'Publication de l’avis', delay: 7, unit: 'calendar_days', enabled: true, applicableTo: ['DAR'] },
    { key: 'cra_competition', label: 'Délai de mise en concurrence CRA', sourceField: 'announcement_date', sourceLabel: 'Publication de l’avis', delay: 7, unit: 'calendar_days', enabled: true, applicableTo: ['CRA'] },
    { key: 'cae_competition', label: 'Délai de mise en concurrence CAE', sourceField: 'announcement_date', sourceLabel: 'Publication de l’avis', delay: 10, unit: 'calendar_days', enabled: true, applicableTo: ['CAE'] },
    { key: 'cme_competition', label: 'Délai de mise en concurrence CME', sourceField: 'announcement_date', sourceLabel: 'Publication de l’avis', delay: 30, unit: 'calendar_days', enabled: true, applicableTo: ['CME'] },
    { key: 'dar_urgent_competition', label: 'Délai urgent de mise en concurrence DAR', sourceField: 'announcement_date', sourceLabel: 'Publication de l’avis', delay: 1, unit: 'calendar_days', enabled: true, applicableTo: ['DAR', 'urgent'] },
    { key: 'cra_urgent_competition', label: 'Délai urgent de mise en concurrence CRA', sourceField: 'announcement_date', sourceLabel: 'Publication de l’avis', delay: 1, unit: 'calendar_days', enabled: true, applicableTo: ['CRA', 'urgent'] },
    { key: 'cae_urgent_competition', label: 'Délai urgent de mise en concurrence CAE', sourceField: 'announcement_date', sourceLabel: 'Publication de l’avis', delay: 3, unit: 'calendar_days', enabled: true, applicableTo: ['CAE', 'urgent'] },
    { key: 'cme_urgent_competition', label: 'Délai urgent de mise en concurrence CME', sourceField: 'announcement_date', sourceLabel: 'Publication de l’avis', delay: 15, unit: 'calendar_days', enabled: true, applicableTo: ['CME', 'urgent'] },
    { key: 'opening_minutes', label: 'Ouverture des plis après la date limite', sourceField: 'submission_deadline', sourceLabel: 'Date limite de remise des offres', delay: 3, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'evaluation_dar', label: 'Évaluation des offres DAR', sourceField: 'bid_opening_date', sourceLabel: 'Ouverture des plis', delay: 7, unit: 'calendar_days', enabled: true, applicableTo: ['DAR'] },
    { key: 'evaluation_cra', label: 'Évaluation des offres CRA', sourceField: 'bid_opening_date', sourceLabel: 'Ouverture des plis', delay: 30, unit: 'calendar_days', enabled: true, applicableTo: ['CRA'] },
    { key: 'evaluation_cae', label: 'Évaluation des offres CAE', sourceField: 'bid_opening_date', sourceLabel: 'Ouverture des plis', delay: 30, unit: 'calendar_days', enabled: true, applicableTo: ['CAE'] },
    { key: 'evaluation_cme', label: 'Évaluation des offres CME', sourceField: 'bid_opening_date', sourceLabel: 'Ouverture des plis', delay: 60, unit: 'calendar_days', enabled: true, applicableTo: ['CME'] },
    { key: 'committee_decision_notice', label: 'Décision de la commission CME', sourceField: 'complete_file_received_by_cme', sourceLabel: 'Réception du dossier complet par la CME', delay: 20, unit: 'calendar_days', enabled: true, applicableTo: ['CME'] },
    { key: 'clarification_request', label: 'Demande d’éclaircissement du candidat écarté', sourceField: 'results_publication_date', sourceLabel: 'Publication des résultats', delay: 3, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'clarification_response', label: 'Réponse à une demande d’éclaircissement', sourceField: 'clarification_received', sourceLabel: 'Réception de la demande', delay: 2, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'standstill', label: 'Délai avant décision finale ou signature', sourceField: 'results_publication_date', sourceLabel: 'Publication des résultats', delay: 5, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'draft_contract', label: 'Préparation du projet de contrat', sourceField: 'committee_decision_date', sourceLabel: 'Réception de la décision d’attribution', delay: 5, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'legal_review', label: 'Revue juridique du contrat', sourceField: 'contract_preparation_date', sourceLabel: 'Transmission du projet au juridique', delay: 10, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'signed_contract_return', label: 'Retour du contrat signé et de la garantie', sourceField: 'contract_notification_date', sourceLabel: 'Notification du contrat', delay: 10, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'definitive_bond', label: 'Présentation de la garantie définitive', sourceField: 'purchase_order_notification', sourceLabel: 'Notification du bon de commande', delay: 20, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'offer_validity', label: 'Validité des offres', sourceField: 'submission_deadline', sourceLabel: 'Date limite de remise des offres', delay: 60, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'goods_acceptance', label: 'Réception des biens ou services', sourceField: 'delivery_date', sourceLabel: 'Livraison ou réalisation', delay: 15, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'works_measurement', label: 'Constatation ou métrage des travaux', sourceField: 'work_request_date', sourceLabel: 'Échéance contractuelle ou demande', delay: 8, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'payment_mandate', label: 'Mandatement du paiement', sourceField: 'rights_certified_date', sourceLabel: 'Certification des droits ou dossier complet', delay: 30, unit: 'business_days', enabled: true, applicableTo: ['all'] },
    { key: 'acceptance_issue_notice', label: 'Notification d’impossibilité d’accepter ou de payer', sourceField: 'rights_certified_date', sourceLabel: 'Certification des droits', delay: 15, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'payment_execution', label: 'Exécution du paiement', sourceField: 'payment_order_date', sourceLabel: 'Ordre de paiement', delay: 15, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'final_settlement_submission', label: 'Dépôt du décompte définitif', sourceField: 'final_acceptance_date', sourceLabel: 'Réception définitive', delay: 90, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'final_settlement_review', label: 'Examen du décompte définitif', sourceField: 'final_settlement_complete', sourceLabel: 'Réception du dossier complet', delay: 20, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'guarantee_return_month', label: 'Restitution de garantie — cas à un mois', sourceField: 'provisional_reception_date', sourceLabel: 'Réception provisoire', delay: 1, unit: 'calendar_months', enabled: true, applicableTo: ['all'] },
    { key: 'guarantee_return_four_months', label: 'Restitution de garantie ou retenue — cas à quatre mois', sourceField: 'final_reception_date', sourceLabel: 'Réception définitive', delay: 4, unit: 'calendar_months', enabled: true, applicableTo: ['all'] },
    { key: 'quantity_termination', label: 'Délai de demande de résiliation après dépassement de volume', sourceField: 'quantity_threshold_exceeded', sourceLabel: 'Acte de dépassement du seuil', delay: 45, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'transport_damage_port', label: 'Recours pour avarie de transport — port ou aéroport', sourceField: 'unloading_at_port', sourceLabel: 'Déchargement au port ou à l’aéroport', delay: 60, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
    { key: 'transport_damage_site', label: 'Recours pour avarie — réception GCT', sourceField: 'unloading_at_site', sourceLabel: 'Déchargement à la réception GCT', delay: 5, unit: 'calendar_days', enabled: true, applicableTo: ['all'] },
  ],
};

export function calculateSurveillanceDueDate(start: string, delay: number, unit: SurveillanceRule['unit'], holidays: string[] = []) {
  const date = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (unit === 'calendar_days') date.setUTCDate(date.getUTCDate() + delay);
  else if (unit === 'calendar_months') {
    const dayOfMonth = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + delay);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(dayOfMonth, lastDay));
  } else {
    let remaining = delay;
    while (remaining > 0) {
      date.setUTCDate(date.getUTCDate() + 1);
      const day = date.getUTCDay();
      if (day !== 0 && day !== 6 && !holidays.includes(date.toISOString().slice(0, 10))) remaining -= 1;
    }
  }
  return date.toISOString().slice(0, 10);
}
