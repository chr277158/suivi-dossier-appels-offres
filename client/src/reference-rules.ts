export type ReferenceRules = {
  masks: { dossier: string; contract: string; annual: string };
  thresholds: {
    study: { craMax: number; caeMax: number };
    servicesAndGoods: { craMin: number; craMax: number; caeMax: number };
  };
};

export const requestTypeValues = {
  studies: 'Etudes',
  goodsAndServices: 'Fourniture de biens, d’équipement et de services',
} as const;

export const defaultReferenceRules: ReferenceRules = {
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

function normalizeRequestType(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

export function expectedCommission(requestType: string, budget: number, rules: ReferenceRules) {
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

export function suggestDossierReference(
  references: readonly string[],
  requestType: string,
  budget: number | null,
  rules: ReferenceRules,
  year = new Date().getFullYear(),
) {
  if (budget === null) return null;
  const expected = expectedCommission(requestType, budget, rules);
  if (!expected) return null;

  const yearCode = String(year % 100).padStart(2, '0');
  const assignedNumbers = new Set(references.flatMap((reference) => {
    const match = reference.match(/^[A-Z]{2}\.(\d{2})\.3\.(\d{4})$/);
    return match?.[1] === yearCode ? [Number(match[2])] : [];
  }));
  let nextNumber = 1;
  while (assignedNumbers.has(nextNumber) && nextNumber <= 9999) nextNumber += 1;
  if (nextNumber > 9999) return null;

  const serial = String(nextNumber).padStart(4, '0');
  const suggestion = formatReference(`${expected.prefix}${yearCode}3${serial}`, rules.masks.dossier, expected.prefix);
  return isReferenceMaskValid(suggestion, rules.masks.dossier) ? suggestion : null;
}

export function suggestContractNumber(
  contractNumbers: readonly string[],
  rules: ReferenceRules,
  year = new Date().getFullYear(),
) {
  const mask = rules.masks.contract;
  const tokenPatterns: Record<string, string> = { A: '[A-Z]', '9': '\\d', '*': '[A-Z0-9]' };
  let pattern = '^';
  let groupCount = 0;
  let firstLetterCount = 0;
  const digitGroups: number[] = [];
  const digitGroupLengths: number[] = [];

  for (let index = 0; index < mask.length; index += 1) {
    const character = mask[index];
    if (character === '9') {
      let runLength = 1;
      while (mask[index + runLength] === '9') runLength += 1;
      groupCount += 1;
      digitGroups.push(groupCount);
      digitGroupLengths.push(runLength);
      pattern += `(\\d{${runLength}})`;
      index += runLength - 1;
    } else if (character === 'A') {
      if (firstLetterCount < 2) {
        pattern += firstLetterCount === 0 ? 'A' : 'P';
        firstLetterCount += 1;
      } else pattern += tokenPatterns.A;
    } else if (character === '*') pattern += tokenPatterns['*'];
    else pattern += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  if (digitGroups.length < 2) return null;
  const matchPattern = new RegExp(`${pattern}$`);
  const yearGroup = digitGroups[0];
  const serialGroup = digitGroups[digitGroups.length - 1];
  const yearLength = digitGroupLengths[0];
  const serialLength = digitGroupLengths[digitGroupLengths.length - 1];
  const yearCode = String(year % (10 ** yearLength)).padStart(yearLength, '0');
  const assignedNumbers = new Set(contractNumbers.flatMap((contractNumber) => {
    const match = contractNumber.match(matchPattern);
    return match?.[yearGroup] === yearCode ? [Number(match[serialGroup])] : [];
  }));

  let nextNumber = 1;
  const maxNumber = 10 ** serialLength - 1;
  while (assignedNumbers.has(nextNumber) && nextNumber <= maxNumber) nextNumber += 1;
  if (nextNumber > maxNumber) return null;

  const serial = String(nextNumber).padStart(serialLength, '0');
  const suggestion = formatReference(`${yearCode}3${serial}`, mask, 'AP');
  return isReferenceMaskValid(suggestion, mask) ? suggestion : null;
}

export function isReferenceMaskValid(value: string, mask: string) {
  const tokenPatterns: Record<string, string> = { A: '[A-Z]', '9': '\\d', '*': '[A-Z0-9]' };
  const pattern = [...mask].map((character) => tokenPatterns[character] ?? character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  return new RegExp(`^${pattern}$`).test(value);
}

export function referenceRuleWarning(requestType: string, budget: number | null, committee: string | null, reference: string, mask: string, rules: ReferenceRules, language: 'fr' | 'ar') {
  if (reference && !isReferenceMaskValid(reference, mask)) {
    return language === 'ar'
      ? `يجب أن يحترم المرجع القناع: ${mask}.`
      : `La référence doit respecter le masque : ${mask}.`;
  }
  const normalizedType = normalizeRequestType(requestType);
  const knownType = normalizedType.includes('etude') || normalizedType.includes('service') || normalizedType.includes('fourniture') || normalizedType.includes('equipement') || normalizedType.includes('bien');
  if (knownType && budget === null) {
    return language === 'ar'
      ? 'أدخل الميزانية لتحديد اللجنة والبادئة المتوقعة.'
      : 'Saisissez le budget pour déterminer la commission et le préfixe attendus.';
  }
  const expected = requestType && budget !== null ? expectedCommission(requestType, budget, rules) : null;
  if (requestType && budget !== null && !expected) {
    return language === 'ar' ? 'لا توجد لجنة محددة لهذا النوع والمبلغ.' : 'Aucune commission n’est définie pour ce type et ce montant.';
  }
  if (expected && committee?.trim().toUpperCase() !== expected.commission) {
    return language === 'ar'
      ? `اللجنة المتوقعة لهذا النوع والمبلغ هي ${expected.commission}.`
      : `Pour ce type et ce budget, la commission attendue est ${expected.commission}.`;
  }
  if (expected && reference.length >= 2 && reference.slice(0, 2) !== expected.prefix) {
    return language === 'ar'
      ? `البادئة المتوقعة هي ${expected.prefix}.`
      : `Le préfixe attendu pour cette commission est ${expected.prefix}.`;
  }
  return null;
}
