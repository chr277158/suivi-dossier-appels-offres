import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, CalendarDays, Check, FilePlus2, Pencil, Search, Trash2 } from 'lucide-react';
import type { Labels, Language } from './i18n';
import { defaultReferenceRules, expectedCommission, formatReference, isReferenceMaskValid, referenceRuleWarning, requestTypeValues, suggestDossierReference, type ReferenceRules } from './reference-rules';
import { DateInput, formatDate, formatDateTime, todayISODate } from './date-format';
import './dossier-records.css';
import './dossier-form.css';

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type DossierStatus = 'draft' | 'published' | 'evaluation' | 'awarded' | 'unsuccessful' | 'cancelled';
type SelectOption = { id: number; list_key: string; option_value: string; label_fr: string; label_ar: string; sort_order: number; is_active?: boolean };
type Dossier = {
  id: number;
  reference: string;
  subject: string;
  estimated_cost: number | null;
  estimated_currency: string;
  provisional_bond_amount: number | null;
  provisional_bond_return_status: 'returned' | 'not_returned';
  launch_specification_status: 'completed' | 'in_preparation';
  request_type: string | null;
  expense_nature: string | null;
  procedure_type: string | null;
  committee: string | null;
  owner_name: string | null;
  owner_user_id: number | null;
  status: DossierStatus;
  status_manually_set: boolean;
  is_urgent: boolean;
  via_tuneps: boolean;
  status_manual_until?: string | null;
  announcement_date: string | null;
  submission_deadline: string | null;
  bid_opening_date: string | null;
  committee_decision_date: string | null;
  specification_approval_date: string | null;
  evaluation_report_date: string | null;
  contract_notification_date: string | null;
  results_publication_date: string | null;
  provisional_bond_return_date: string | null;
  definitive_bond_request_date: string | null;
  contract_preparation_date: string | null;
};
type DossierForm = Omit<Dossier, 'id'>;
type PageResult = { data: Dossier[]; pagination: { page: number; pageSize: number; total: number; pages: number } };
type DossierClarification = { id: number; subject: string; received_at: string | null; response: string | null; sent_at: string | null };
type DossierNote = { id: number; body: string; author: string | null; created_at: string };
type DossierContract = { id: number; contract_number: string; subject: string; holder: string | null; amount: number | null; currency: string; state: string };
type TrackingStep = { step_key: string; completed_at: string | null };
type DossierOwnerHistory = { id: number; previous_owner_name: string | null; new_owner_name: string | null; transferred_by_name: string; transferred_at: string };

const trackingSteps = [
  ['request_received', 'Réception de la demande', 'استلام الطلب'],
  ['needs_defined', 'Définition des besoins', 'تحديد الحاجيات'],
  ['committee_appointed', 'Désignation de la commission', 'تعيين اللجنة'],
  ['committee_approved', 'Approbation par la commission', 'مصادقة اللجنة'],
  ['specifications_drafted', 'Rédaction du cahier des charges', 'إعداد كراس الشروط'],
  ['specifications_validated', 'Validation du cahier des charges', 'المصادقة على كراس الشروط'],
  ['launch_authorized', 'Autorisation de lancement', 'الإذن بالإطلاق'],
  ['announcement_published', 'Publication de l’avis', 'نشر الإعلان'],
  ['submission_closed', 'Clôture des dépôts', 'غلق قبول العروض'],
  ['bids_opened', 'Ouverture des plis', 'فتح العروض'],
  ['offers_evaluated', 'Évaluation des offres', 'تقييم العروض'],
  ['evaluation_approved', 'Approbation du rapport d’évaluation', 'المصادقة على تقرير التقييم'],
  ['committee_decision', 'Décision de la commission', 'قرار اللجنة'],
  ['results_published', 'Publication des résultats', 'نشر النتائج'],
  ['award_notified', 'Notification de l’attribution', 'الإعلام بالإسناد'],
  ['provisional_bond_returned', 'Restitution de la caution provisoire', 'إرجاع الضمان الوقتي'],
  ['definitive_bond_requested', 'Demande de la caution définitive', 'طلب الضمان النهائي'],
  ['definitive_bond_received', 'Réception de la caution définitive', 'استلام الضمان النهائي'],
  ['contract_prepared', 'Préparation du contrat', 'إعداد العقد'],
  ['contract_signed', 'Signature du contrat', 'إمضاء العقد'],
  ['contract_approved', 'Visa ou approbation du contrat', 'التأشير على العقد'],
  ['contract_registered', 'Enregistrement du contrat', 'تسجيل العقد'],
  ['contract_effective', 'Entrée en vigueur', 'دخول العقد حيز التنفيذ'],
] as const;

const blankDossier: DossierForm = {
  reference: '', subject: '', estimated_cost: null, estimated_currency: 'TND', provisional_bond_amount: null, provisional_bond_return_status: 'not_returned', launch_specification_status: 'in_preparation', request_type: '', expense_nature: '', procedure_type: '', committee: '', owner_name: '', owner_user_id: null,
  status: 'draft', status_manually_set: false, is_urgent: false, via_tuneps: false, status_manual_until: null, announcement_date: null, submission_deadline: null, bid_opening_date: null,
  committee_decision_date: null, specification_approval_date: null, evaluation_report_date: null,
  contract_notification_date: null, results_publication_date: null, provisional_bond_return_date: null,
  definitive_bond_request_date: null, contract_preparation_date: null,
};

const dateFields: [keyof DossierForm, keyof Labels][] = [
  ['specification_approval_date', 'dateSpecification'], ['announcement_date', 'dateAnnouncement'],
  ['submission_deadline', 'dateDeadline'], ['bid_opening_date', 'dateOpening'],
  ['evaluation_report_date', 'dateEvaluation'], ['committee_decision_date', 'dateDecision'], ['results_publication_date', 'dateResults'],
  ['contract_notification_date', 'dateNotification'], ['provisional_bond_return_date', 'dateProvisionalReturn'],
  ['definitive_bond_request_date', 'dateDefinitiveBond'], ['contract_preparation_date', 'dateContractPreparation'],
];

const procedureDateOrder: [keyof DossierForm, keyof DossierForm][] = [
  ['specification_approval_date', 'announcement_date'],
  ['announcement_date', 'submission_deadline'],
  ['submission_deadline', 'bid_opening_date'],
  ['bid_opening_date', 'evaluation_report_date'],
  ['evaluation_report_date', 'committee_decision_date'],
  ['committee_decision_date', 'results_publication_date'],
  ['results_publication_date', 'contract_notification_date'],
];

function dossierDateOrderIssue(value: DossierForm, t: Labels) {
  for (const [earlierKey, laterKey] of procedureDateOrder) {
    const earlier = value[earlierKey];
    const later = value[laterKey];
    if (typeof earlier !== 'string' || !earlier || typeof later !== 'string' || !later) continue;
    if (later.slice(0, 16) < earlier.slice(0, 16)) {
      const earlierLabel = dateFields.find(([key]) => key === earlierKey)?.[1];
      const laterLabel = dateFields.find(([key]) => key === laterKey)?.[1];
      return {
        fields: [earlierKey, laterKey] as const,
        message: t.dateOrderError
          .replace('{later}', laterLabel ? t[laterLabel] : String(laterKey))
          .replace('{earlier}', earlierLabel ? t[earlierLabel] : String(earlierKey)),
      };
    }
  }
  return null;
}

function statusLabel(status: DossierStatus, t: Labels, options: SelectOption[], language: Language) {
  const keys: Record<DossierStatus, keyof Labels> = {
    draft: 'statusDraft', published: 'statusPublished', evaluation: 'statusEvaluation',
    awarded: 'statusAwarded', unsuccessful: 'statusUnsuccessful', cancelled: 'statusCancelled',
  };
  const dynamic = options.find((option) => option.list_key === 'dossier_status' && option.option_value === status && option.is_active !== false);
  return dynamic ? (language === 'ar' ? dynamic.label_ar : dynamic.label_fr) : keys[status] ? t[keys[status]] : status;
}

function asDate(value: string | null, language: Language) {
  void language;
  return value ? formatDate(value) : '';
}

function asDateTime(value: string | null, language: Language) {
  void language;
  return value ? formatDateTime(value) : '';
}

function nullable(value: string) {
  return value.trim() ? value.trim() : null;
}

function automaticDossierStatus(value: DossierForm): DossierStatus {
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!value.announcement_date || value.announcement_date > todayValue) return 'draft';
  if (value.bid_opening_date && value.bid_opening_date.slice(0, 10) <= todayValue) return 'evaluation';
  return 'published';
}

function toForm(dossier: Dossier): DossierForm {
  return {
    reference: dossier.reference,
    subject: dossier.subject,
    estimated_cost: dossier.estimated_cost,
    estimated_currency: dossier.estimated_currency ?? 'TND',
    provisional_bond_amount: dossier.provisional_bond_amount === null ? null : Number(dossier.provisional_bond_amount),
    provisional_bond_return_status: dossier.provisional_bond_return_status ?? 'not_returned',
    launch_specification_status: dossier.launch_specification_status ?? 'in_preparation',
    request_type: dossier.request_type ?? '',
    expense_nature: dossier.expense_nature ?? '',
    procedure_type: dossier.procedure_type ?? '',
    committee: dossier.committee ?? '',
    owner_name: dossier.owner_name ?? '',
    owner_user_id: dossier.owner_user_id === null ? null : Number(dossier.owner_user_id),
    status: dossier.status,
    status_manually_set: dossier.status_manually_set ?? false,
    is_urgent: dossier.is_urgent ?? false,
    via_tuneps: dossier.via_tuneps ?? false,
    status_manual_until: dossier.status_manual_until ?? null,
    announcement_date: dossier.announcement_date?.slice(0, 10) ?? null,
    submission_deadline: dossier.submission_deadline?.replace(' ', 'T').slice(0, 16) ?? null,
    bid_opening_date: dossier.bid_opening_date?.replace(' ', 'T').slice(0, 16) ?? null,
    committee_decision_date: dossier.committee_decision_date?.slice(0, 10) ?? null,
    specification_approval_date: dossier.specification_approval_date?.slice(0, 10) ?? null,
    evaluation_report_date: dossier.evaluation_report_date?.slice(0, 10) ?? null,
    contract_notification_date: dossier.contract_notification_date?.slice(0, 10) ?? null,
    results_publication_date: dossier.results_publication_date?.slice(0, 10) ?? null,
    provisional_bond_return_date: dossier.provisional_bond_return_date?.slice(0, 10) ?? null,
    definitive_bond_request_date: dossier.definitive_bond_request_date?.slice(0, 10) ?? null,
    contract_preparation_date: dossier.contract_preparation_date?.slice(0, 10) ?? null,
  };
}

export function DossiersPage({ api, t, language, initialEditId, onEditLinkConsumed, canWrite, canCreate, canManageOwner, canDelete, userId, options }: { api: Api; t: Labels; language: Language; initialEditId: number | null; onEditLinkConsumed: () => void; canWrite: boolean; canCreate: boolean; canManageOwner: boolean; canDelete: boolean; userId: number; options: SelectOption[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<Dossier[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ id: number | null; value: DossierForm } | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [referenceRules, setReferenceRules] = useState<ReferenceRules>(defaultReferenceRules);
  const [existingReferences, setExistingReferences] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api<{ data: ReferenceRules }>('/reference-rules')
      .then((result) => { if (!cancelled) setReferenceRules(result.data); })
      .catch((cause) => { if (!cancelled) setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); });
    return () => { cancelled = true; };
  }, [api, language, t.failure]);

  useEffect(() => {
    if (initialEditId === null) return;
    let cancelled = false;
    void api<{ data: Dossier }>(`/dossiers/${initialEditId}`).then((result) => {
      if (cancelled) return;
      setSelectedId(result.data.id);
      onEditLinkConsumed();
    }).catch((cause) => {
      if (cancelled) return;
      setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure);
      onEditLinkConsumed();
    });
    return () => { cancelled = true; };
  }, [initialEditId, api, language, onEditLinkConsumed, t.failure]);

  useEffect(() => {
    if (selectedId !== null || editor) return;
    const params = new URLSearchParams({ page: '1', pageSize: '100' });
    if (query.trim()) params.set('q', query.trim());
    if (status) params.set('status', status);
    void api<PageResult>(`/dossiers?${params}`).then((result) => {
      setItems(result.data);
      setError('');
    }).catch((cause) => setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure));
  }, [api, query, status, selectedId, editor, reload, t.failure, language]);

  async function openCreate() {
    setError('');
    try {
      const firstPage = await api<PageResult>('/dossiers?page=1&pageSize=100');
      const pages: PageResult[] = [];
      for (let page = 2; page <= firstPage.pagination.pages; page += 5) {
        pages.push(...await Promise.all(
          Array.from({ length: Math.min(5, firstPage.pagination.pages - page + 1) }, (_, index) =>
            api<PageResult>(`/dossiers?page=${page + index}&pageSize=100`)),
        ));
      }
      setExistingReferences([...firstPage.data, ...pages.flatMap((page) => page.data)].map(({ reference }) => reference));
      setEditor({ id: null, value: blankDossier });
    } catch (cause) {
      setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure);
    }
  }

  async function saveDossier(value: DossierForm, id: number | null, confirmStatusOverride: boolean): Promise<Dossier> {
    const payload = {
      ...value,
      confirm_status_override: confirmStatusOverride,
      estimated_cost: value.estimated_cost === null ? null : Number(value.estimated_cost),
      estimated_currency: value.estimated_currency.trim().toUpperCase(),
      expense_nature: nullable(String(value.expense_nature ?? '')),
      request_type: nullable(String(value.request_type ?? '')),
      procedure_type: nullable(String(value.procedure_type ?? '')),
      committee: nullable(String(value.committee ?? '')),
      owner_name: nullable(String(value.owner_name ?? '')),
    };
    const result = await api<{ data: Dossier }>(id === null ? '/dossiers' : `/dossiers/${id}`, {
      method: id === null ? 'POST' : 'PATCH',
      body: JSON.stringify(payload),
    });
    setEditor(null);
    setSelectedId(id);
    setReload((current) => current + 1);
    return result.data;
  }

  if (editor) return <DossierEditor
    initial={editor.value}
    isNew={editor.id === null}
    existingReferences={existingReferences}
    title={editor.id === null ? t.newDossierTitle : t.editDossierTitle}
    api={api}
    referenceRules={referenceRules}
    canManageOwner={canManageOwner}
    error={error}
    language={language}
    options={options}
    t={t}
    onCancel={() => { setEditor(null); setError(''); }}
    onSave={async (value, confirmStatusOverride) => { await saveDossier(value, editor.id, confirmStatusOverride); }}
  />;

  if (selectedId !== null) return <DossierDetail
    id={selectedId}
    startEditing={initialEditId !== null}
    api={api}
    referenceRules={referenceRules}
    t={t}
    language={language}
    options={options}
    canWrite={canWrite}
    userId={userId}
    canManageOwner={canManageOwner}
    canDelete={canDelete}
    onBack={() => { setSelectedId(null); setError(''); }}
    onSave={(value, confirmStatusOverride) => saveDossier(value, selectedId, confirmStatusOverride)}
    onDeleted={() => { setSelectedId(null); setReload((current) => current + 1); }}
  />;

  return <>
    <div className="page-heading dossier-heading">
      <div><span className="eyebrow">{t.dossierEyebrow}</span><h1>{t.dossiers}</h1><p>{items.length} {t.dossier} · {t.shown}</p></div>
      {canCreate && <button className="primary-button" onClick={openCreate}><FilePlus2 size={16} /> {t.newDossier}</button>}
    </div>
    <div className="dossier-toolbar">
      <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} /></label>
      <div className="dossier-status-filters" aria-label={t.filterByStatus}>
        <button className={!status ? 'selected' : ''} onClick={() => setStatus('')}>{t.all}</button>
        {options.filter((option) => option.list_key === 'dossier_status' && option.is_active !== false).map((option) => <button key={option.id} className={status === option.option_value ? 'selected' : ''} onClick={() => setStatus(status === option.option_value ? '' : option.option_value)}>{language === 'ar' ? option.label_ar : option.label_fr}</button>)}
      </div>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {items.length ? <div className="dossier-grid">{items.map((dossier) => <DossierCard key={dossier.id} dossier={dossier} t={t} language={language} options={options} onOpen={() => setSelectedId(dossier.id)} />)}</div> : <div className="dossier-empty"><FilePlus2 size={24} /><strong>{error ? t.loadFailure : t.noDossierFound}</strong><span>{query || status ? t.adjustFilters : t.startCreate}</span>{canCreate && !query && !status && <button className="secondary-button" onClick={openCreate}>{t.createDossier}</button>}</div>}
  </>;
}

function DossierCard({ dossier, t, language, options, onOpen }: { dossier: Dossier; t: Labels; language: Language; options: SelectOption[]; onOpen: () => void }) {
  return <article className="dossier-card">
    <div className="dossier-card-top"><span className={`dossier-status status-${dossier.status}`}>{statusLabel(dossier.status, t, options, language)}</span><span className="dossier-cost">{dossier.estimated_cost === null ? t.budgetUndefined : `${Number(dossier.estimated_cost).toLocaleString(language === 'ar' ? 'ar-TN' : 'fr-FR')} ${dossier.estimated_currency || 'TND'}`}</span></div>
    <a className="dossier-card-reference" href={`#/dossiers/${dossier.id}/edit`}>{dossier.reference}</a>
    <button className="dossier-card-title" onClick={onOpen}><strong>{dossier.subject}</strong></button>
    <div className="dossier-card-meta"><span>{dossier.owner_user_id ? dossier.owner_name || t.ownerUnassigned : t.ownerUnassigned}</span>{dossier.submission_deadline && <span><CalendarDays size={14} /> {t.limit} {asDateTime(dossier.submission_deadline, language)}</span>}</div>
    <button className="dossier-card-open" onClick={onOpen}>{t.openDossier} <span aria-hidden="true">→</span></button>
  </article>;
}

function DossierDetail({ id, startEditing, api, t, language, options, referenceRules, canWrite, userId, canManageOwner, canDelete, onBack, onSave, onDeleted }: {
  id: number; startEditing: boolean; api: Api; t: Labels; language: Language; options: SelectOption[]; referenceRules: ReferenceRules; canWrite: boolean; userId: number; canManageOwner: boolean; canDelete: boolean; onBack: () => void;
  onSave: (value: DossierForm, confirmStatusOverride: boolean) => Promise<Dossier>; onDeleted: () => void;
}) {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [value, setValue] = useState<DossierForm>(blankDossier);
  const [editing, setEditing] = useState(startEditing);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [clarifications, setClarifications] = useState<DossierClarification[]>([]);
  const [notes, setNotes] = useState<DossierNote[]>([]);
  const [contracts, setContracts] = useState<DossierContract[]>([]);
  const [ownerHistory, setOwnerHistory] = useState<DossierOwnerHistory[]>([]);
  const [steps, setSteps] = useState<TrackingStep[]>(() => trackingSteps.map(([step_key]) => ({ step_key, completed_at: null })));
  const [recordError, setRecordError] = useState('');
  const [tab, setTab] = useState<'sheet' | 'notes' | 'clarifications' | 'contracts' | 'tracking' | 'owners'>('sheet');
  const [saving, setSaving] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [contractSaving, setContractSaving] = useState(false);
  const [currencyChoice, setCurrencyChoice] = useState('TND');
  const [owners, setOwners] = useState<{ id: number; full_name: string }[]>([]);
  const [ownerLoadError, setOwnerLoadError] = useState('');
  const currencyOptions = options.filter((option) => option.list_key === 'currency' && option.is_active !== false);

  const dateOrderIssue = dossierDateOrderIssue(value, t);

  useEffect(() => {
    if (!canManageOwner) return;
    void api<{ data: { id: number; full_name: string }[] }>('/dossier-owners')
      .then((result) => setOwners(result.data.map((owner) => ({ ...owner, id: Number(owner.id) }))))
      .catch((cause) => setOwnerLoadError(cause instanceof Error ? cause.message : t.failure));
  }, [api, canManageOwner, t.failure]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await api<{ data: Dossier }>(`/dossiers/${id}`);
        if (!cancelled) {
          setDossier(result.data);
          setValue(toForm(result.data));
        }
      } catch (cause) {
        if (!cancelled) setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure);
      }
    };
    void load();
    void api<{ data: DossierClarification[] }>(`/clarifications?dossierId=${id}`).then((result) => { if (!cancelled) setClarifications(result.data); }).catch((cause) => { if (!cancelled) setRecordError(cause instanceof Error ? cause.message : t.failure); });
    void api<{ data: DossierNote[] }>(`/notes?dossierId=${id}`).then((result) => { if (!cancelled) setNotes(result.data); }).catch((cause) => { if (!cancelled) setRecordError(cause instanceof Error ? cause.message : t.failure); });
    void api<{ data: DossierContract[] }>(`/dossiers/${id}/contracts`).then((result) => { if (!cancelled) setContracts(result.data); }).catch((cause) => { if (!cancelled) setRecordError(cause instanceof Error ? cause.message : t.failure); });
    void api<{ data: DossierOwnerHistory[] }>(`/dossiers/${id}/owner-history`).then((result) => { if (!cancelled) setOwnerHistory(result.data); }).catch((cause) => { if (!cancelled) setRecordError(cause instanceof Error ? cause.message : t.failure); });
    void api<{ data: TrackingStep[] }>(`/dossiers/${id}/tracking`).then((result) => {
      if (!cancelled) {
        const saved = new Map(result.data.map((step) => [step.step_key, step.completed_at]));
        setSteps(trackingSteps.map(([step_key]) => ({ step_key, completed_at: saved.get(step_key) ?? null })));
      }
    }).catch((cause) => { if (!cancelled) setRecordError(cause instanceof Error ? cause.message : t.failure); });
    return () => { cancelled = true; };
  }, [api, id, t.failure, language]);

  useEffect(() => {
    if (!dossier) return;
    setCurrencyChoice(options.some((option) => option.list_key === 'currency' && option.option_value === dossier.estimated_currency && option.is_active !== false) ? dossier.estimated_currency : 'OTHER');
  }, [dossier, options]);

  function update<Key extends keyof DossierForm>(key: Key, next: DossierForm[Key]) {
    setValue((current) => ({ ...current, [key]: next }));
    setError('');
  }

  async function addDossierRecord(event: FormEvent<HTMLFormElement>, type: 'note' | 'clarification') {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setRecordError('');
    try {
      if (type === 'clarification') {
        const result = await api<{ data: DossierClarification }>('/clarifications', { method: 'POST', body: JSON.stringify({ dossierId: id, subject: form.get('subject'), response: form.get('response') }) });
        setClarifications((current) => [result.data, ...current]);
      } else {
        const result = await api<{ data: DossierNote }>('/notes', { method: 'POST', body: JSON.stringify({ dossierId: id, body: form.get('body') }) });
        setNotes((current) => [result.data, ...current]);
      }
      formElement.reset();
    } catch (cause) { setRecordError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); }
  }

  async function saveDossier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const launchStarted = (value.announcement_date !== null && value.announcement_date !== (dossier?.announcement_date?.slice(0, 10) ?? null))
      || (value.status === 'published' && dossier?.status !== 'published');
    if (launchStarted && value.launch_specification_status !== 'completed') {
      setError(t.launchRequiresCompletedSpecification);
      return;
    }
    const referenceChanged = !dossier
      || value.reference !== dossier.reference
      || value.request_type !== (dossier.request_type ?? '')
      || value.estimated_cost !== dossier.estimated_cost
      || value.committee !== (dossier.committee ?? '');
    const referenceWarning = referenceChanged
      ? referenceRuleWarning(value.request_type ?? '', value.estimated_cost, value.committee, value.reference, referenceRules.masks.dossier, referenceRules, language)
      : null;
    if (!isReferenceMaskValid(value.reference, referenceRules.masks.dossier) && referenceChanged) {
      setError(t.referenceMaskWarning.replace('{mask}', referenceRules.masks.dossier));
      return;
    }
    if (referenceWarning) {
      setError(referenceWarning);
      return;
    }
    if (dateOrderIssue) {
      setError(dateOrderIssue.message);
      return;
    }
    const activeOverride = Boolean(dossier?.status_manually_set && dossier.status === value.status && (!dossier.status_manual_until || new Date(dossier.status_manual_until).getTime() > Date.now()));
    const needsConfirmation = value.status !== automaticDossierStatus(value) && !activeOverride;
    if (needsConfirmation && !window.confirm(language === 'ar' ? 'الحالة المختارة تختلف عن الحساب التلقائي. سيتم حفظها كاستثناء مؤقت لمدة 24 ساعة، ثم قد يستبدلها الحساب التلقائي. هل تريد المتابعة؟' : `Le statut choisi (« ${statusLabel(value.status, t, options, language)} ») diffère du calcul automatique (« ${statusLabel(automaticDossierStatus(value), t, options, language)} »). La dérogation sera enregistrée pour 24 heures, puis le calcul automatique pourra la remplacer. Continuer ?`)) return;
    setSaving(true);
    setError('');
    try {
      const saved = await onSave(value, needsConfirmation);
      setDossier(saved);
      setValue(toForm(saved));
      void api<{ data: DossierOwnerHistory[] }>(`/dossiers/${id}/owner-history`).then((result) => setOwnerHistory(result.data)).catch((cause) => setRecordError(cause instanceof Error ? cause.message : t.failure));
      setSteps((current) => current.map((step) => step.step_key === 'provisional_bond_returned'
        ? { ...step, completed_at: saved.provisional_bond_return_status === 'returned' ? saved.provisional_bond_return_date?.slice(0, 10) ?? todayISODate() : null }
        : step));
      setEditing(false);
    } catch (cause) {
      setError(language === 'ar' ? t.saveFailed : cause instanceof Error ? cause.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function saveTracking() {
    setTrackingSaving(true);
    setRecordError('');
    try {
      const result = await api<{ data: TrackingStep[] }>(`/dossiers/${id}/tracking`, { method: 'PUT', body: JSON.stringify({ steps }) });
      const saved = new Map(result.data.map((step) => [step.step_key, step.completed_at]));
      setSteps(trackingSteps.map(([step_key]) => ({ step_key, completed_at: saved.get(step_key) ?? null })));
      const returnDate = saved.get('provisional_bond_returned') ?? null;
      setValue((current) => ({ ...current, provisional_bond_return_date: returnDate }));
      setDossier((current) => current ? { ...current, provisional_bond_return_date: returnDate } : current);
    } catch (cause) {
      setRecordError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure);
    } finally {
      setTrackingSaving(false);
    }
  }

  async function addContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setContractSaving(true);
    setRecordError('');
    try {
      const contractDates = ['date_first_legal_document', 'date_send_admin_signature', 'date_admin_signed_return', 'date_send_client_signature', 'date_client_signed_return', 'date_send_registration', 'date_registered_return', 'date_effective', 'date_end', 'date_archived'];
      const payload = {
        dossier_id: id,
        contract_number: form.get('contract_number'),
        subject: form.get('subject'),
        holder: nullable(String(form.get('holder') ?? '')),
        amount: form.get('amount') ? Number(form.get('amount')) : null,
        currency: String(form.get('currency') || 'TND').toUpperCase(),
        state: String(form.get('state') || 'pending'),
        ...Object.fromEntries(contractDates.map((field) => [field, null])),
      };
      const result = await api<{ data: DossierContract }>('/contracts', { method: 'POST', body: JSON.stringify(payload) });
      setContracts((current) => [result.data, ...current]);
      formElement.reset();
    } catch (cause) {
      setRecordError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure);
    } finally {
      setContractSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`${t.confirmDelete} ${dossier?.reference} ؟`)) return;
    setDeleting(true);
    try {
      await api(`/dossiers/${id}`, { method: 'DELETE' });
      onDeleted();
    } catch (cause) {
      setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure);
    } finally {
      setDeleting(false);
    }
  }

  if (!dossier) return <div className="dossier-loading">{error || t.loading}</div>;
  const canEditDossier = canWrite || dossier.owner_user_id === userId;
  const ownerOnlyEdit = !canWrite;
  const canEditField = (field: keyof DossierForm) => editing && (!ownerOnlyEdit || [
    'reference', 'request_type', 'estimated_cost', 'estimated_currency', 'committee',
    'is_urgent', 'via_tuneps', 'announcement_date', 'submission_deadline', 'bid_opening_date', 'results_publication_date',
  ].includes(field));
  const completedSteps = steps.filter((step) => step.completed_at).length;
  const progress = steps.length ? Math.round(completedSteps / steps.length * 100) : 0;
  const expectedRule = value.request_type && value.estimated_cost !== null ? expectedCommission(value.request_type, value.estimated_cost, referenceRules) : null;
  const referenceWarning = referenceRuleWarning(value.request_type ?? '', value.estimated_cost, value.committee, value.reference, referenceRules.masks.dossier, referenceRules, language);
  const tabs = [
    ['sheet', t.tabSheet, 0], ['notes', t.tabNotes, notes.length],
    ['clarifications', t.tabClarifications, clarifications.length],
    ['contracts', t.tabContracts, contracts.length], ['tracking', t.tabTracking, `${completedSteps}/${trackingSteps.length}`],
    ['owners', t.tabOwnerHistory, ownerHistory.length],
  ] as const;

  return <>
    <div className="dossier-detail-heading">
      <button className="secondary-button small" onClick={onBack}><ArrowLeft size={15} /> {t.backToDossiers}</button>
      <div className="dossier-detail-actions">{editing && canEditDossier && <><button type="button" className="secondary-button" onClick={() => { if (dossier) setValue(toForm(dossier)); setEditing(false); }}>{t.cancel}</button><button className="primary-button" form="dossier-detail-form" disabled={saving}>{saving ? t.saving : t.saveDossier}</button></>}{canEditDossier && !editing && <button className="secondary-button" onClick={() => setEditing(true)}><Pencil size={15} /> {t.edit}</button>}{canDelete && <button className="secondary-button danger-action" onClick={remove}><Trash2 size={15} />{deleting ? t.deleting : t.delete}</button>}</div>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {ownerLoadError && <p className="error-message" role="alert">{ownerLoadError}</p>}
    <section className="dossier-detail-title"><span className={`dossier-status status-${dossier.status}`}>{statusLabel(editing ? value.status : dossier.status, t, options, language)}</span><span className="eyebrow">{editing ? value.reference : dossier.reference}</span><h1>{editing ? value.subject : dossier.subject}</h1><p>{dossier.procedure_type || t.procedureNotReported} · {dossier.expense_nature || t.natureNotReported}</p></section>
    <nav className="dossier-tabs" aria-label={t.dossierTabs}>{tabs.map(([key, label, count]) => <button type="button" key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}<span>{count}</span></button>)}</nav>
    {recordError && <p className="error-message" role="alert">{recordError}</p>}
    {tab === 'sheet' && <form id="dossier-detail-form" className="dossier-detail-sheet" onSubmit={saveDossier}>
      <section className="dossier-form-section"><h2>{t.identification}</h2><div className="dossier-form-grid">
        <label>{t.reference} *<input value={value.reference} disabled={!canEditField('reference')} required maxLength={80} onChange={(event) => update('reference', formatReference(event.target.value, referenceRules.masks.dossier, expectedRule?.prefix))} />{referenceWarning && editing && <small className="reference-rule-warning" role="alert">{referenceWarning}</small>}{expectedRule && <small className="reference-rule-hint">{t.expectedCommittee}: {expectedRule.commission} · {expectedRule.prefix}</small>}</label>
        <label>{t.dossierStatus}<select value={value.status} disabled={!canEditField('status')} onChange={(event) => update('status', event.target.value as DossierStatus)}>{value.status && !options.some((option) => option.list_key === 'dossier_status' && option.option_value === value.status && option.is_active !== false) && <option value={value.status}>{statusLabel(value.status, t, [], language)}</option>}{options.filter((option) => option.list_key === 'dossier_status' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
        <label className="form-span-all">{t.subject} *<textarea value={value.subject} disabled={!canEditField('subject')} required maxLength={500} rows={2} onChange={(event) => update('subject', event.target.value)} /></label>
        <label>{t.requestType}<select value={value.request_type ?? ''} disabled={!canEditField('request_type')} onChange={(event) => update('request_type', event.target.value || null)}><option value="">{t.selectOption}</option>{value.request_type && value.request_type !== requestTypeValues.studies && value.request_type !== requestTypeValues.goodsAndServices && <option value={value.request_type}>{value.request_type}</option>}<option value={requestTypeValues.studies}>{t.requestTypeStudies}</option><option value={requestTypeValues.goodsAndServices}>{t.requestTypeGoodsServices}</option></select></label>
        <label>{t.estimatedBudget}<div className="budget-input-group"><input type="number" min="0" max="99999999999.999" step="0.001" value={value.estimated_cost ?? ''} disabled={!canEditField('estimated_cost')} onChange={(event) => update('estimated_cost', event.target.value === '' ? null : Number(event.target.value))} /><select value={currencyChoice} disabled={!canEditField('estimated_currency')} onChange={(event) => { setCurrencyChoice(event.target.value); if (event.target.value !== 'OTHER') update('estimated_currency', event.target.value); }}>{currencyOptions.map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}<option value="OTHER">{t.otherCurrency}</option></select></div>{currencyChoice === 'OTHER' && <input value={value.estimated_currency} disabled={!canEditField('estimated_currency')} required minLength={3} maxLength={3} pattern="[A-Z]{3}" onChange={(event) => update('estimated_currency', event.target.value.toUpperCase())} />}</label>
        <label>{t.expenseNature}<select value={value.expense_nature ?? ''} disabled={!canEditField('expense_nature')} onChange={(event) => update('expense_nature', event.target.value)}><option value="">{t.selectOption}</option>{value.expense_nature && !options.some((option) => option.list_key === 'expense_nature' && option.option_value === value.expense_nature && option.is_active !== false) && <option value={value.expense_nature}>{value.expense_nature}</option>}{options.filter((option) => option.list_key === 'expense_nature' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
        <label>{t.procedureType}<select value={value.procedure_type ?? ''} disabled={!canEditField('procedure_type')} onChange={(event) => update('procedure_type', event.target.value)}><option value="">{t.selectOption}</option>{value.procedure_type && !options.some((option) => option.list_key === 'procedure_type' && option.option_value === value.procedure_type && option.is_active !== false) && <option value={value.procedure_type}>{value.procedure_type}</option>}{options.filter((option) => option.list_key === 'procedure_type' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
        <label>{t.committee}<select value={value.committee ?? ''} disabled={!canEditField('committee')} onChange={(event) => update('committee', event.target.value)}><option value="">{t.selectOption}</option>{value.committee && !options.some((option) => option.list_key === 'committee' && option.option_value === value.committee && option.is_active !== false) && <option value={value.committee}>{value.committee}</option>}{options.filter((option) => option.list_key === 'committee' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
        <label>{t.dossierOwner}<select value={value.owner_user_id ?? (value.owner_name ? `legacy:${value.owner_name}` : '')} disabled={!canEditField('owner_user_id') || !canManageOwner} onChange={(event) => { const selected = event.target.value; const owner = owners.find((item) => Number(item.id) === Number(selected)); update('owner_user_id', owner?.id ?? null); update('owner_name', owner?.full_name ?? (selected.startsWith('legacy:') ? selected.slice(7) : '')); }}><option value="">{t.notAssigned}</option>{value.owner_name && !owners.some((owner) => owner.id === value.owner_user_id) && <option disabled value={`legacy:${value.owner_name}`}>{value.owner_name} · {t.inactiveOwner}</option>}{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label>
        <div className="dossier-four-fields">
          <fieldset className="launch-specification-status" disabled={!canEditField('launch_specification_status')}><legend>{t.launchSpecificationStatus}</legend><label><input type="radio" name="launch_specification_status" value="completed" checked={value.launch_specification_status === 'completed'} onChange={() => update('launch_specification_status', 'completed')} />{t.specificationCompleted}</label><label><input type="radio" name="launch_specification_status" value="in_preparation" checked={value.launch_specification_status === 'in_preparation'} onChange={() => update('launch_specification_status', 'in_preparation')} />{t.specificationInPreparation}</label></fieldset>
          <fieldset className="provisional-bond-status" disabled={!canEditField('provisional_bond_return_status')}><legend>{t.provisionalBond}</legend><label><input type="radio" name="provisional_bond_return_status" value="returned" checked={value.provisional_bond_return_status === 'returned'} onChange={() => { update('provisional_bond_return_status', 'returned'); update('provisional_bond_return_date', value.provisional_bond_return_date ?? todayISODate()); }} />{t.provisionalBondReturned}</label><label><input type="radio" name="provisional_bond_return_status" value="not_returned" checked={value.provisional_bond_return_status === 'not_returned'} onChange={() => { update('provisional_bond_return_status', 'not_returned'); update('provisional_bond_return_date', null); }} />{t.provisionalBondNotReturned}</label></fieldset>
          <label className="compliance-checkbox"><input type="checkbox" checked={value.via_tuneps} disabled={!canEditField('via_tuneps')} onChange={(event) => update('via_tuneps', event.target.checked)} />{t.viaTuneps}</label>
          <label className="compliance-checkbox"><input type="checkbox" checked={value.is_urgent} disabled={!canEditField('is_urgent')} onChange={(event) => update('is_urgent', event.target.checked)} />{t.urgentJustification}</label>
        </div>
      </div></section>
      <section className="dossier-form-section"><h2>{t.procedureDates}</h2><div className="dossier-form-grid dossier-date-grid">{dateFields.map(([key, label]) => { const dateTime = key === 'submission_deadline' || key === 'bid_opening_date'; const hasDateOrderError = dateOrderIssue?.fields.includes(key) ?? false; return <label key={key} className={hasDateOrderError ? 'date-order-invalid' : undefined}>{t[label]}<DateInput aria-invalid={hasDateOrderError} dateTime={dateTime} disabled={!canEditField(key)} value={String(value[key] ?? '')} onChange={(next) => update(key, next || null)} /></label>; })}</div></section>
    </form>}
    {tab === 'notes' && <section className="dossier-records-panel"><header><h2>{t.tabNotes}</h2></header>{canWrite && <form className="dossier-record-form" onSubmit={(event) => addDossierRecord(event, 'note')}><label>{t.comment}<textarea name="body" rows={3} required maxLength={4000} /></label><button className="primary-button">{t.addNote}</button></form>}<ul className="dossier-record-list">{notes.map((note) => <li key={note.id}><p>{note.body}</p><small>{note.author || t.notReported} · {formatDateTime(note.created_at)}</small></li>)}{!notes.length && <li className="empty-state">{t.noRows}</li>}</ul></section>}
    {tab === 'clarifications' && <section className="dossier-records-panel"><header><h2>{t.tabClarifications}</h2></header>{canWrite && <form className="dossier-record-form" onSubmit={(event) => addDossierRecord(event, 'clarification')}><label>{t.subject}<input name="subject" required maxLength={500} /></label><label>{t.response}<textarea name="response" rows={2} maxLength={4000} /></label><button className="primary-button">{t.addClarification}</button></form>}<ul className="dossier-record-list">{clarifications.map((item) => <li key={item.id}><strong>{item.subject}</strong>{item.response && <p>{item.response}</p>}<small>{item.received_at ? asDate(item.received_at, language) : t.notReported}{item.sent_at ? ` · ${asDate(item.sent_at, language)}` : ''}</small></li>)}{!clarifications.length && <li className="empty-state">{t.noRows}</li>}</ul></section>}
    {tab === 'contracts' && <section className="dossier-records-panel"><header><h2>{t.tabContracts}</h2></header>{canWrite && <form className="dossier-contract-form" onSubmit={addContract}>    <label>{t.contractNumber}<input name="contract_number" required maxLength={80} onChange={(event) => { event.currentTarget.value = formatReference(event.currentTarget.value, referenceRules.masks.contract, 'AP'); }} /></label><label>{t.subject}<input name="subject" required maxLength={500} defaultValue={dossier.subject} /></label><label>{t.holder}<input name="holder" maxLength={200} /></label><label>{t.amount}<input name="amount" type="number" min="0" step="0.001" /></label><label>{t.currency}<select name="currency" defaultValue="TND">{currencyOptions.map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label><label>{t.contractState}<select name="state" defaultValue="pending">{options.filter((option) => option.list_key === 'contract_state' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label><button className="primary-button" disabled={contractSaving}>{contractSaving ? t.saving : t.addContract}</button></form>}<ul className="dossier-record-list">{contracts.map((contract) => <li key={contract.id}><strong>{contract.contract_number}</strong> · {contract.subject}<p>{contract.holder || t.notReported} · {contract.amount === null ? t.notReported : `${Number(contract.amount).toLocaleString(language === 'ar' ? 'ar-TN' : 'fr-FR')} ${contract.currency}`}</p><small>{contract.state}</small></li>)}{!contracts.length && <li className="empty-state">{t.noRows}</li>}</ul></section>}
    {tab === 'tracking' && <section className="dossier-records-panel"><header><h2>{t.tabTracking}</h2><strong>{completedSteps}/{trackingSteps.length} · {progress}%</strong></header><div className="tracking-progress"><span style={{ width: `${progress}%` }} /></div><ul className="dossier-tracking-list">{trackingSteps.map(([key, labelFr, labelAr]) => { const step = steps.find((item) => item.step_key === key); return <li key={key}><label><input type="checkbox" checked={Boolean(step?.completed_at)} disabled={!canWrite} onChange={(event) => setSteps((current) => current.map((item) => item.step_key === key ? { ...item, completed_at: event.target.checked ? todayISODate() : null } : item))} /><span><Check size={15} /> {language === 'ar' ? labelAr : labelFr}</span></label><DateInput aria-label={language === 'ar' ? labelAr : labelFr} value={step?.completed_at ?? ''} disabled={!canWrite} onChange={(next) => setSteps((current) => current.map((item) => item.step_key === key ? { ...item, completed_at: next || null } : item))} /></li>; })}</ul>{canWrite && <button className="primary-button" disabled={trackingSaving} onClick={() => void saveTracking()}>{trackingSaving ? t.saving : t.saveTracking}</button>}</section>}
    {tab === 'owners' && <section className="dossier-records-panel"><header><h2>{t.tabOwnerHistory}</h2></header><ul className="dossier-record-list">{ownerHistory.map((entry) => <li key={entry.id}><strong>{entry.previous_owner_name || t.notAssigned} → {entry.new_owner_name || t.notAssigned}</strong><p>{t.ownerTransferBy}: {entry.transferred_by_name}</p><small>{formatDateTime(entry.transferred_at)}</small></li>)}{!ownerHistory.length && <li className="empty-state">{t.ownerHistoryEmpty}</li>}</ul></section>}
  </>;
}

function DossierEditor({ initial, isNew, existingReferences, title, error, api, canManageOwner, options, referenceRules, t, language, onCancel, onSave }: {
  initial: DossierForm; isNew: boolean; existingReferences: string[]; title: string; error: string; api: Api; canManageOwner: boolean; options: SelectOption[]; referenceRules: ReferenceRules; t: Labels; language: Language; onCancel: () => void; onSave: (value: DossierForm, confirmStatusOverride: boolean) => Promise<void>;
}) {
  const [value, setValue] = useState<DossierForm>(initial);
  const [busy, setBusy] = useState(false);
  const [confirmStatusOverride, setConfirmStatusOverride] = useState(false);
  const [localError, setLocalError] = useState('');
  const [ownerLoadError, setOwnerLoadError] = useState('');
  const [owners, setOwners] = useState<{ id: number; full_name: string }[]>([]);
  const [currencyChoice, setCurrencyChoice] = useState(options.some((option) => option.list_key === 'currency' && option.option_value === initial.estimated_currency && option.is_active !== false) ? initial.estimated_currency : 'OTHER');
  const currencyOptions = options.filter((option) => option.list_key === 'currency' && option.is_active !== false);
  const hasExistingManualOverride = Boolean(
    initial.status_manually_set
    && initial.status === value.status
    && (!initial.status_manual_until || new Date(initial.status_manual_until).getTime() > Date.now()),
  );
  const statusDiffersFromAutomatic = value.status !== automaticDossierStatus(value) && !hasExistingManualOverride;
  const expectedRule = value.request_type && value.estimated_cost !== null ? expectedCommission(value.request_type, value.estimated_cost, referenceRules) : null;
  const suggestedReference = isNew
    ? suggestDossierReference(existingReferences, value.request_type ?? '', value.estimated_cost, referenceRules)
    : null;
  const referenceWarning = referenceRuleWarning(value.request_type ?? '', value.estimated_cost, value.committee, value.reference, referenceRules.masks.dossier, referenceRules, language);
  const dateOrderIssue = dossierDateOrderIssue(value, t);

  useEffect(() => {
    let cancelled = false;
    void api<{ data: { id: number; full_name: string }[] }>('/dossier-owners').then((result) => {
      if (!cancelled) setOwners(result.data.map((owner) => ({ ...owner, id: Number(owner.id) })));
    }).catch((cause) => setOwnerLoadError(cause instanceof Error ? cause.message : t.failure));
    return () => { cancelled = true; };
  }, [api, t.failure]);

  function update<Key extends keyof DossierForm>(key: Key, next: DossierForm[Key]) {
    setValue((current) => ({ ...current, [key]: next }));
    setLocalError('');
  }

  async function persist(confirmOverride: boolean) {
    setBusy(true);
    setLocalError('');
    try {
      await onSave(value, confirmOverride);
    } catch (cause) {
      setLocalError(language === 'ar' ? t.saveFailed : cause instanceof Error ? cause.message : t.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const launchStarted = (value.announcement_date !== null && value.announcement_date !== (initial.announcement_date ?? null))
      || (value.status === 'published' && initial.status !== 'published');
    if (launchStarted && value.launch_specification_status !== 'completed') {
      setLocalError(t.launchRequiresCompletedSpecification);
      return;
    }
    if (!isReferenceMaskValid(value.reference, referenceRules.masks.dossier)) {
      setLocalError(t.referenceMaskWarning.replace('{mask}', referenceRules.masks.dossier));
      return;
    }
    if (referenceWarning) {
      setLocalError(referenceWarning);
      return;
    }
    if (dateOrderIssue) {
      setLocalError(dateOrderIssue.message);
      return;
    }
    if (statusDiffersFromAutomatic) {
      setConfirmStatusOverride(true);
      return;
    }
    await persist(false);
  }

  return <form className="dossier-editor" lang={language} onSubmit={submit}>
    <div className="dossier-editor-header"><div><span className="eyebrow">{t.tenders}</span><h1>{title}</h1><p>{t.requiredNotice}</p></div><button type="button" className="secondary-button small" onClick={onCancel}><ArrowLeft size={15} /> {t.cancel}</button></div>
    {(error || localError) && <p className="error-message" role="alert">{localError || error}</p>}
    {ownerLoadError && <p className="error-message" role="alert">{ownerLoadError}</p>}
    <section className="dossier-form-section"><h2>{t.identification}</h2><div className="dossier-form-grid">
      <label>{t.reference} *<input value={value.reference} onChange={(event) => update('reference', formatReference(event.target.value, referenceRules.masks.dossier, expectedRule?.prefix))} required maxLength={80} />{referenceWarning && <small className="reference-rule-warning" role="alert">{referenceWarning}</small>}{expectedRule && <small className="reference-rule-hint">{t.expectedCommittee}: {expectedRule.commission} · {expectedRule.prefix}</small>}{isNew && <span className="reference-suggestion"><small>{suggestedReference ? `${t.suggestedReference}: ${suggestedReference}` : t.referenceSuggestionUnavailable}</small>{suggestedReference && <button type="button" className="secondary-button small" onClick={() => update('reference', suggestedReference)}>{t.useReferenceSuggestion}</button>}</span>}</label>
      <label>{t.dossierStatus}<select value={value.status} onChange={(event) => update('status', event.target.value as DossierStatus)}>{value.status && !options.some((option) => option.list_key === 'dossier_status' && option.option_value === value.status && option.is_active !== false) && <option value={value.status}>{statusLabel(value.status, t, [], language)}</option>}{options.filter((option) => option.list_key === 'dossier_status' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select>{statusDiffersFromAutomatic && <small className="dossier-status-warning"><AlertTriangle size={14} />{language === 'ar' ? `الحالة المحسوبة تلقائياً: ${statusLabel(automaticDossierStatus(value), t, options, language)}.` : `Le statut calculé automatiquement est « ${statusLabel(automaticDossierStatus(value), t, options, language)} ».`}</small>}</label>
      <label className="form-span-all">{t.subject} *<textarea value={value.subject} onChange={(event) => update('subject', event.target.value)} required maxLength={500} rows={2} /></label>
      <label>{t.requestType}<select value={value.request_type ?? ''} onChange={(event) => update('request_type', event.target.value)}><option value="">{t.selectOption}</option>{value.request_type && value.request_type !== requestTypeValues.studies && value.request_type !== requestTypeValues.goodsAndServices && <option value={value.request_type}>{value.request_type}</option>}<option value={requestTypeValues.studies}>{t.requestTypeStudies}</option><option value={requestTypeValues.goodsAndServices}>{t.requestTypeGoodsServices}</option></select></label>
      <label>{t.estimatedBudget}<div className="budget-input-group"><input type="number" min="0" max="99999999999.999" step="0.001" value={value.estimated_cost ?? ''} onChange={(event) => update('estimated_cost', event.target.value === '' ? null : Number(event.target.value))} /><select aria-label={t.currency} value={currencyChoice} onChange={(event) => { const next = event.target.value; setCurrencyChoice(next); if (next !== 'OTHER') update('estimated_currency', next); else if (currencyOptions.some((option) => option.option_value === value.estimated_currency)) update('estimated_currency', ''); }}>{!currencyOptions.some((option) => option.option_value === currencyChoice) && currencyChoice !== 'OTHER' && <option value={currencyChoice}>{currencyChoice}</option>}{currencyOptions.map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}<option value="OTHER">{t.otherCurrency}</option></select></div>{currencyChoice === 'OTHER' && <input aria-label={t.otherCurrency} value={value.estimated_currency} onChange={(event) => update('estimated_currency', event.target.value.toUpperCase().slice(0, 3))} required minLength={3} maxLength={3} pattern="[A-Z]{3}" placeholder="Ex. GBP" />}</label>
      <label>{t.expenseNature}<select value={value.expense_nature ?? ''} onChange={(event) => update('expense_nature', event.target.value)}><option value="">{t.selectOption}</option>{value.expense_nature && !options.some((option) => option.list_key === 'expense_nature' && option.option_value === value.expense_nature && option.is_active !== false) && <option value={value.expense_nature}>{value.expense_nature}</option>}{options.filter((option) => option.list_key === 'expense_nature' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
      <label>{t.procedureType}<select value={value.procedure_type ?? ''} onChange={(event) => update('procedure_type', event.target.value)}><option value="">{t.selectOption}</option>{value.procedure_type && !options.some((option) => option.list_key === 'procedure_type' && option.option_value === value.procedure_type && option.is_active !== false) && <option value={value.procedure_type}>{value.procedure_type}</option>}{options.filter((option) => option.list_key === 'procedure_type' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
      <label>{t.committee}<select value={value.committee ?? ''} onChange={(event) => update('committee', event.target.value)}><option value="">{t.selectOption}</option>{value.committee && !options.some((option) => option.list_key === 'committee' && option.option_value === value.committee && option.is_active !== false) && <option value={value.committee}>{value.committee}</option>}{options.filter((option) => option.list_key === 'committee' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
      <label className="form-span-all">{t.dossierOwner}<select value={value.owner_user_id ?? (value.owner_name ? `legacy:${value.owner_name}` : '')} disabled={!canManageOwner} onChange={(event) => { const selected = event.target.value; const owner = owners.find((item) => Number(item.id) === Number(selected)); update('owner_user_id', owner?.id ?? null); update('owner_name', owner?.full_name ?? (selected.startsWith('legacy:') ? selected.slice(7) : '')); }}><option value="">{t.notAssigned}</option>{value.owner_name && !owners.some((owner) => owner.id === value.owner_user_id) && <option disabled value={`legacy:${value.owner_name}`}>{value.owner_name} · {t.inactiveOwner}</option>}{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select></label>
      <div className="dossier-four-fields">
        <fieldset className="launch-specification-status"><legend>{t.launchSpecificationStatus}</legend><label><input type="radio" name="launch_specification_status" value="completed" checked={value.launch_specification_status === 'completed'} onChange={() => update('launch_specification_status', 'completed')} />{t.specificationCompleted}</label><label><input type="radio" name="launch_specification_status" value="in_preparation" checked={value.launch_specification_status === 'in_preparation'} onChange={() => update('launch_specification_status', 'in_preparation')} />{t.specificationInPreparation}</label></fieldset>
        <fieldset className="provisional-bond-status"><legend>{t.provisionalBond}</legend><label><input type="radio" name="provisional_bond_return_status" value="returned" checked={value.provisional_bond_return_status === 'returned'} onChange={() => { update('provisional_bond_return_status', 'returned'); update('provisional_bond_return_date', value.provisional_bond_return_date ?? todayISODate()); }} />{t.provisionalBondReturned}</label><label><input type="radio" name="provisional_bond_return_status" value="not_returned" checked={value.provisional_bond_return_status === 'not_returned'} onChange={() => { update('provisional_bond_return_status', 'not_returned'); update('provisional_bond_return_date', null); }} />{t.provisionalBondNotReturned}</label></fieldset>
        <label className="compliance-checkbox"><input type="checkbox" checked={value.via_tuneps} onChange={(event) => update('via_tuneps', event.target.checked)} />{t.viaTuneps}</label>
        <label className="compliance-checkbox"><input type="checkbox" checked={value.is_urgent} onChange={(event) => update('is_urgent', event.target.checked)} />{t.urgentJustification}</label>
      </div>
    </div></section>
    <section className="dossier-form-section"><h2>{t.procedureDates}</h2><div className="dossier-form-grid dossier-date-grid">
      {dateFields.map(([key, label]) => {
        const dateTime = key === 'submission_deadline' || key === 'bid_opening_date';
        const hasDateOrderError = dateOrderIssue?.fields.includes(key) ?? false;
        return <label key={key} className={hasDateOrderError ? 'date-order-invalid' : undefined}>{t[label]}<input aria-invalid={hasDateOrderError} type={dateTime ? 'datetime-local' : 'date'} value={String(value[key] ?? '').replace(' ', 'T').slice(0, dateTime ? 16 : 10)} onChange={(event) => update(key, event.target.value || null)} /></label>;
      })}
    </div></section>
    <div className="dossier-editor-actions"><button type="button" className="secondary-button" onClick={onCancel}>{t.cancel}</button><button className="primary-button" disabled={busy}>{busy ? t.saving : t.saveDossier}</button></div>
    {confirmStatusOverride && <div className="status-override-backdrop"><section className="status-override-dialog" role="dialog" aria-modal="true" aria-labelledby="status-override-title"><span className="status-override-icon"><AlertTriangle size={22} /></span><h2 id="status-override-title">{language === 'ar' ? 'الحالة المختارة لا تتوافق مع التواريخ' : 'Ce statut ne correspond pas aux dates du dossier'}</h2><p>{language === 'ar' ? `وفقاً للتواريخ، الحالة التلقائية هي « ${statusLabel(automaticDossierStatus(value), t, options, language)} ». قبل الإعلان، الحالة «قيد الإعداد»؛ وبعد الإعلان وقبل فتح العروض، «تم الإعلان»؛ وبعد فتح العروض، «قيد التقييم». إذا تابعت، سيتم الاحتفاظ بالحالة المختارة لمدة 24 ساعة، ثم سيعيد النظام تطبيق الحالة المحسوبة تلقائياً.` : `Selon les dates renseignées, le statut attendu est « ${statusLabel(automaticDossierStatus(value), t, options, language)} ». Avant la date d’annonce, le dossier est « En préparation » ; après l’annonce et avant l’ouverture des plis, il est « Lancé » ; à partir de l’ouverture des plis, il passe « En évaluation ». Si vous continuez, votre choix sera conservé pendant 24 heures, puis le statut automatique sera réappliqué.`}</p><div className="status-override-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirmStatusOverride(false)}>{language === 'ar' ? 'العودة للتعديل' : 'Revenir au formulaire'}</button><button type="button" className="primary-button" disabled={busy} onClick={() => { setConfirmStatusOverride(false); void persist(true); }}>{busy ? t.saving : language === 'ar' ? 'تأكيد لمدة 24 ساعة' : 'Confirmer pour 24 heures'}</button></div></section></div>}
  </form>;
}
