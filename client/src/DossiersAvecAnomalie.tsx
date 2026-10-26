import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BellRing, Check, CircleHelp, Pencil, RotateCcw, X } from 'lucide-react';
import type { Labels } from './i18n';
import { defaultReferenceRules, type ReferenceRules } from './reference-rules';
import { verifierDossiers, type ComplianceDossier, type ComplianceFinding } from './dossier-compliance';
import './dossier-compliance.css';

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type Recipient = { full_name?: string | null; name?: string | null; email: string | null };
type Recipients = { owner: Recipient; contributors: Recipient[]; administrators: Recipient[] };
type DossierPage = { data: ComplianceDossier[]; pagination: { pages: number } };
type Contract = { id: number; dossier_id: number | null; contract_number: string; subject: string; holder: string | null; state: string };
type ContractPage = { data: Contract[]; pagination: { pages: number } };
type ComplianceCard = { dossier: ComplianceDossier; findings: ComplianceFinding[] };

export function DossiersAvecAnomalie({
  api,
  t,
  onCorrect,
  canCorrect,
  currentUserId,
  canIgnore,
  ignored,
  onIgnoredChange,
}: {
  api: Api;
  t: Labels;
  onCorrect: (id: number) => void;
  canCorrect: boolean;
  currentUserId: number;
  canIgnore: boolean;
  ignored: Record<string, boolean>;
  onIgnoredChange: (key: string, isIgnored: boolean) => void;
}) {
  const apiRef = useRef(api);
  apiRef.current = api;
  const [dossiers, setDossiers] = useState<ComplianceDossier[]>([]);
  const [orphanContracts, setOrphanContracts] = useState<Contract[]>([]);
  const [rules, setRules] = useState<ReferenceRules>(defaultReferenceRules);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ dossier: ComplianceDossier; recipients: Recipients; sent: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void Promise.all([
      apiRef.current<{ data: ReferenceRules }>('/reference-rules'),
      apiRef.current<DossierPage>('/dossiers?page=1&pageSize=100'),
      apiRef.current<ContractPage>('/contracts?page=1&pageSize=100'),
    ]).then(async ([rulesResult, firstPage, firstContractPage]) => {
      const pages: DossierPage[] = [];
      for (let page = 2; page <= firstPage.pagination.pages; page += 5) {
        pages.push(...await Promise.all(
          Array.from({ length: Math.min(5, firstPage.pagination.pages - page + 1) }, (_, index) =>
            apiRef.current<DossierPage>(`/dossiers?page=${page + index}&pageSize=100`)),
        ));
      }
      const contractPages: ContractPage[] = [];
      for (let page = 2; page <= firstContractPage.pagination.pages; page += 5) {
        contractPages.push(...await Promise.all(
          Array.from({ length: Math.min(5, firstContractPage.pagination.pages - page + 1) }, (_, index) =>
            apiRef.current<ContractPage>(`/contracts?page=${page + index}&pageSize=100`)),
        ));
      }
      if (cancelled) return;
      setRules(rulesResult.data);
      setDossiers([...firstPage.data, ...pages.flatMap((page) => page.data)]);
      setOrphanContracts([...firstContractPage.data, ...contractPages.flatMap((page) => page.data)].filter((contract) => contract.dossier_id === null));
    }).catch((cause: unknown) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : t.failure);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [t.failure]);

  const anomalous = useMemo(() => verifierDossiers(dossiers, rules), [dossiers, rules]);
  const activeCards: ComplianceCard[] = useMemo(() => anomalous.map(({ dossier, findings }) => ({
    dossier,
    findings: findings.filter((finding) => !ignored[`${dossier.id}:${finding.key}`]),
  })).filter(({ findings }) => findings.length > 0), [anomalous, ignored]);
  const activeOrphanContracts = orphanContracts.filter((contract) => !ignored[`contract:${contract.id}:missing-dossier`]);

  async function prepareNotification(dossier: ComplianceDossier) {
    setError('');
    try {
      const result = await api<{ data: Recipients }>(`/dossiers/${dossier.id}/compliance-recipients`);
      setNotification({ dossier, recipients: result.data, sent: false });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.failure);
    }
  }

  function ignore(dossierId: number, finding: ComplianceFinding) {
    if (!canIgnore) return;
    onIgnoredChange(`${dossierId}:${finding.key}`, true);
  }

  function reactivate(dossierId: number, finding: ComplianceFinding) {
    if (!canIgnore) return;
    onIgnoredChange(`${dossierId}:${finding.key}`, false);
  }

  return <section className="compliance-page">
    <header className="compliance-heading">
      <div><span className="eyebrow">{t.dossiers}</span><h1>{t.anomalyTitle}</h1><p>{t.anomalyDescription}</p></div>
      <span className="compliance-count"><AlertTriangle size={17} />{activeCards.length + activeOrphanContracts.length} {t.anomalyCountLabel}</span>
    </header>
    <p className="compliance-note"><CircleHelp size={16} />{t.anomalyCoverageNote}</p>
    {error && <p className="error-message" role="alert">{error}</p>}
    {loading ? <p className="empty-state" role="status">{t.loading}</p>
      : activeCards.length === 0 && activeOrphanContracts.length === 0 ? <p className="empty-state">{t.noActiveAnomalies}</p>
        : <div className="compliance-list">{activeCards.map(({ dossier, findings }) => <article className="compliance-card" key={dossier.id}>
          <header>
            <div><span className="compliance-reference">{dossier.reference}</span><h2>{dossier.subject}</h2></div>
            <span className="compliance-budget">{dossier.estimated_cost === null ? t.budgetUndefined : `${Number(dossier.estimated_cost).toLocaleString()} ${dossier.estimated_currency}`}</span>
          </header>
          <dl className="compliance-details">
            <div><dt>{t.requestType}</dt><dd>{dossier.request_type || t.notSpecified}</dd></div>
            <div><dt>{t.commission}</dt><dd>{dossier.committee || t.notSpecified}</dd></div>
            <div><dt>{t.dossierOwner}</dt><dd>{dossier.owner_name || t.ownerUnassigned}</dd></div>
          </dl>
          <ul className="compliance-findings">{findings.map((finding) => <li key={finding.key}>
            <AlertTriangle size={16} /><span>{finding.message}</span>
            {canIgnore && <button type="button" className="secondary-button small" onClick={() => ignore(dossier.id, finding)}><Check size={14} />{t.ignoreAnomaly}</button>}
          </li>)}</ul>
          <footer>
            {(canCorrect || dossier.owner_user_id === currentUserId) && <button type="button" className="primary-button" onClick={() => onCorrect(dossier.id)}><Pencil size={15} />{t.correctDossier}</button>}
            <button type="button" className="secondary-button" onClick={() => void prepareNotification(dossier)}><BellRing size={15} />{t.informTeam}</button>
          </footer>
        </article>)}{activeOrphanContracts.map((contract) => <article className="compliance-card" key={`contract-${contract.id}`}>
          <header><div><span className="compliance-reference">{contract.contract_number}</span><h2>{contract.subject}</h2></div><span className="compliance-budget">{t.contracts}</span></header>
          <dl className="compliance-details"><div><dt>{t.holder}</dt><dd>{contract.holder || t.notSpecified}</dd></div><div><dt>{t.state}</dt><dd>{contract.state}</dd></div></dl>
          <ul className="compliance-findings"><li><AlertTriangle size={16} /><span>{t.contractWithoutDossier}</span>
            {canIgnore && <button type="button" className="secondary-button small" onClick={() => onIgnoredChange(`contract:${contract.id}:missing-dossier`, true)}><Check size={14} />{t.ignoreAnomaly}</button>}
          </li></ul>
          {canCorrect && <footer><button type="button" className="primary-button" onClick={() => { window.location.hash = `#/contracts/${contract.id}/edit`; }}><Pencil size={15} />{t.correctContract}</button></footer>}
        </article>)}</div>}
    {canIgnore && Object.entries(ignored).filter(([, isIgnored]) => isIgnored).length > 0 && <details className="ignored-anomalies">
      <summary>{t.ignoredAnomalies}</summary>
      {anomalous.flatMap(({ dossier, findings }) => findings
        .filter((finding) => ignored[`${dossier.id}:${finding.key}`])
        .map((finding) => <div key={`${dossier.id}:${finding.key}`}>
          <span><b>{dossier.reference}:</b> {finding.message}</span>
          <button type="button" className="secondary-button small" onClick={() => reactivate(dossier.id, finding)}><RotateCcw size={14} />{t.reactivateAnomaly}</button>
        </div>))}
      {orphanContracts.filter((contract) => ignored[`contract:${contract.id}:missing-dossier`]).map((contract) => <div key={`contract:${contract.id}:missing-dossier`}>
        <span><b>{contract.contract_number}:</b> {t.contractWithoutDossier}</span>
        <button type="button" className="secondary-button small" onClick={() => onIgnoredChange(`contract:${contract.id}:missing-dossier`, false)}><RotateCcw size={14} />{t.reactivateAnomaly}</button>
      </div>)}
    </details>}
    {notification && <div className="compliance-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNotification(null); }}>
      <section className="compliance-modal" role="dialog" aria-modal="true" aria-labelledby="compliance-notification-title">
        <header><div><span className="eyebrow">{t.notificationCenter}</span><h2 id="compliance-notification-title">{t.notificationPreview}</h2></div><button type="button" className="icon-button" aria-label={t.closeDialog} onClick={() => setNotification(null)}><X size={18} /></button></header>
        <dl>
          <div><dt>{t.to}</dt><dd>{notification.recipients.owner.email || notification.recipients.owner.name || t.noEmailAddress}</dd></div>
          <div><dt>{t.cc}</dt><dd>{[...notification.recipients.contributors, ...notification.recipients.administrators].map((recipient) => recipient.email || recipient.full_name || recipient.name).filter(Boolean).join(', ') || t.noContributorsOrAdministrators}<br /><small>{t.contributorsNotTracked}</small></dd></div>
          <div><dt>{t.subject}</dt><dd>{t.anomalyEmailSubject.replace('{reference}', notification.dossier.reference)}</dd></div>
          <div><dt>{t.message}</dt><dd className="compliance-message-preview">{t.anomalyEmailBody
            .replace('{responsable}', notification.recipients.owner.name ?? notification.recipients.owner.full_name ?? t.notSpecified)
            .replace('{reference}', notification.dossier.reference)
            .replace('{findings}', anomalous.find((item) => item.dossier.id === notification.dossier.id)?.findings.filter((finding) => !ignored[`${notification.dossier.id}:${finding.key}`]).map((finding) => `• ${finding.message}`).join('\n') ?? '')}</dd></div>
        </dl>
        <p className="compliance-simulation-note">{notification.sent ? t.notificationSimulationDone : t.notificationSimulationOnly}</p>
        <footer>
          <button type="button" className="secondary-button" onClick={() => setNotification(null)}>{t.closeDialog}</button>
          {!notification.sent && <button type="button" className="primary-button" onClick={() => setNotification((current) => current ? { ...current, sent: true } : null)}><BellRing size={15} />{t.simulateNotification}</button>}
        </footer>
      </section>
    </div>}
  </section>;
}
