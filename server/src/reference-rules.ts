import { z } from 'zod';

export const defaultReferenceRules = {
  masks: {
    dossier: 'AA.99.3.9999',
    contract: 'AP.99.3.9999',
    annual: 'AA.99.3.9999',
  },
  thresholds: {
    study: { craMax: 15_000, caeMax: 200_000 },
    servicesAndGoods: { craMin: 20_000, craMax: 200_000, caeMax: 2_000_000 },
  },
};

const maskSchema = z.string().trim().min(1).max(40).regex(/^[A-Z0-9*._/-]+$/).refine((mask) => /[A-Z*]/.test(mask) && /9/.test(mask));

export const referenceRulesSchema = z.object({
  masks: z.object({
    dossier: maskSchema,
    contract: maskSchema,
    annual: maskSchema,
  }).strict(),
  thresholds: z.object({
    study: z.object({
      craMax: z.number().finite().positive(),
      caeMax: z.number().finite().positive(),
    }).strict(),
    servicesAndGoods: z.object({
      craMin: z.number().finite().nonnegative(),
      craMax: z.number().finite().positive(),
      caeMax: z.number().finite().positive(),
    }).strict(),
  }).strict(),
}).strict().superRefine((rules, context) => {
  if (rules.thresholds.study.craMax >= rules.thresholds.study.caeMax) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['thresholds', 'study'], message: 'Les seuils Étude doivent être croissants.' });
  }
  if (rules.thresholds.servicesAndGoods.craMin >= rules.thresholds.servicesAndGoods.craMax
    || rules.thresholds.servicesAndGoods.craMax >= rules.thresholds.servicesAndGoods.caeMax) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['thresholds', 'servicesAndGoods'], message: 'Les seuils Services/biens doivent être croissants.' });
  }
});

export type ReferenceRules = z.infer<typeof referenceRulesSchema>;
export type CommissionRule = { commission: 'CRA' | 'CAE' | 'CME'; prefix: 'AG' | 'AF' | 'AE' };

function normalizeRequestType(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

export function expectedCommission(requestType: string, budget: number, rules: ReferenceRules): CommissionRule | null {
  const type = normalizeRequestType(requestType);
  if (type.includes('etude')) {
    if (budget < rules.thresholds.study.craMax) return { commission: 'CRA', prefix: 'AG' };
    if (budget < rules.thresholds.study.caeMax) return { commission: 'CAE', prefix: 'AF' };
    return { commission: 'CME', prefix: 'AE' };
  }
  if (type.includes('service') || type.includes('fourniture') || type.includes('equipement') || type.includes('bien')) {
    const thresholds = rules.thresholds.servicesAndGoods;
    if (budget >= thresholds.craMin && budget < thresholds.craMax) return { commission: 'CRA', prefix: 'AG' };
    if (budget >= thresholds.craMax && budget < thresholds.caeMax) return { commission: 'CAE', prefix: 'AF' };
    if (budget >= thresholds.caeMax) return { commission: 'CME', prefix: 'AE' };
  }
  return null;
}

function maskRegex(mask: string) {
  const tokens: Record<string, string> = { A: '[A-Z]', '9': '\\d', '*': '[A-Z0-9]' };
  const pattern = [...mask].map((character) => tokens[character] ?? character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  return new RegExp(`^${pattern}$`);
}

export function formatReference(value: string, mask: string, prefix?: string) {
  const rawInput = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const input = prefix ? `${prefix}${rawInput.replace(/^[A-Z]{0,2}/, '')}` : rawInput;
  let inputIndex = 0;
  let output = '';
  for (const character of mask) {
    if (character === 'A' || character === '9' || character === '*') {
      const expected = character === 'A' ? /[A-Z]/ : character === '9' ? /\d/ : /[A-Z0-9]/;
      while (inputIndex < input.length && !expected.test(input[inputIndex])) inputIndex += 1;
      if (inputIndex >= input.length) break;
      output += input[inputIndex];
      inputIndex += 1;
    } else {
      if (input[inputIndex] === character) inputIndex += 1;
      if (inputIndex < input.length) output += character;
    }
  }
  if (prefix && output.length) output = `${prefix}${output.slice(Math.min(2, output.length))}`;
  return output;
}

export function referenceValidationError(reference: string, mask: string, requestType: string | null, budget: number | null, committee: string | null, rules: ReferenceRules) {
  if (!maskRegex(mask).test(reference)) return `La référence doit respecter le masque ${mask}.`;
  if (!requestType || budget === null) return null;
  const expected = expectedCommission(requestType, budget, rules);
  if (!expected) return 'Aucune commission n’est définie pour ce type et ce montant.';
  if (committee?.trim().toUpperCase() !== expected.commission) return `Pour ce type et ce budget, la commission attendue est ${expected.commission}.`;
  if (reference.slice(0, 2) !== expected.prefix) return `Le préfixe attendu pour cette commission est ${expected.prefix}.`;
  return null;
}
