import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, ArrowLeft, BriefcaseBusiness, ChevronRight, CircleUserRound, FileText, Globe2, LayoutDashboard, LogOut, Search, ShieldCheck } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

type User = { id: number; email: string; fullName: string; role: string };
type Row = Record<string, string | number | null>;
type Stats = { charts: Record<string, { label: string; value: number }[]>; alerts: { overdueCount: number; overdueDossiers: Row[] } };
type ListResult = { data: Row[]; pagination: { page: number; pageSize: number; total: number; pages: number } };
const API = import.meta.env.VITE_API_BASE || '';
const colors = ['#183e38', '#d16c4b', '#d8a83e', '#6b8474', '#8d9f91', '#afc4b2'];
const labels = {
  fr: { dashboard: 'Tableau de bord', tenders: 'Appels d’offres', contracts: 'Contrats', signIn: 'Se connecter', email: 'Adresse e-mail', password: 'Mot de passe', connect: 'Ouvrir une session', exit: 'Déconnexion', hello: 'Suivi des dossiers', subtitle: 'Vue de pilotage', alert: 'Échéances dépassées', recent: 'Dossiers en retard', tenderRef: 'Référence', subject: 'Objet', status: 'Statut', deadline: 'Date limite', search: 'Filtrer les résultats', filterStatus: 'Tous les statuts', export: 'Exporter CSV', previous: 'Précédent', next: 'Suivant', tracking: 'Suivi contractuel', save: 'Enregistrer les dates', close: 'Fermer', noRows: 'Aucun résultat', failure: 'Impossible de joindre le serveur' },
  ar: { dashboard: 'لوحة القيادة', tenders: 'طلبات العروض', contracts: 'العقود', signIn: 'تسجيل الدخول', email: 'البريد الإلكتروني', password: 'كلمة المرور', connect: 'دخول', exit: 'خروج', hello: 'متابعة الملفات', subtitle: 'لوحة المتابعة', alert: 'آجال متجاوزة', recent: 'الملفات المتأخرة', tenderRef: 'المرجع', subject: 'الموضوع', status: 'الحالة', deadline: 'آخر أجل', search: 'بحث في النتائج', filterStatus: 'كل الحالات', export: 'تصدير CSV', previous: 'السابق', next: 'التالي', tracking: 'متابعة العقد', save: 'حفظ التواريخ', close: 'إغلاق', noRows: 'لا توجد نتائج', failure: 'تعذر الاتصال بالخادم' },
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    throw new Error(`Réponse non JSON de l’API (HTTP ${response.status}). Vérifie /api/health et le routage Vercel.`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || fallback);
  if (payload === null) throw new Error('Réponse JSON invalide de l’API.');
  return payload as T;
}

function App() {
  const [language, setLanguage] = useState<'fr' | 'ar'>('fr');
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'tenders' | 'contracts'>('dashboard');
  const [error, setError] = useState('');
  const t = labels[language];
  const rtl = language === 'ar';

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
    if (response.status === 204) return undefined as T;
    if (response.headers.get('content-type')?.includes('text/csv')) return await response.blob() as T;
    return readJson<T>(response, t.failure);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API}/api/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
      const result = await readJson<{ accessToken: string; user: User }>(response, t.failure);
      setToken(result.accessToken);
      setUser(result.user);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
  }

  async function logout() {
    await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setToken(''); setUser(null);
  }

  return <main className="app-shell" dir={rtl ? 'rtl' : 'ltr'}>
    {!user ? <section className="login-screen">
      <div className="login-art"><span className="eyebrow">GCT · PROCUREMENT</span><h1>{t.hello}</h1><p>{t.subtitle}</p><div className="art-mark"><FileText size={84} strokeWidth={1} /></div></div>
      <form className="login-form" onSubmit={login}>
        <button className="language-switch" type="button" onClick={() => setLanguage(rtl ? 'fr' : 'ar')}><Globe2 size={17} /> {rtl ? 'FR' : 'عربي'}</button>
        <div className="brand-mark"><ShieldCheck size={20} /></div><span className="eyebrow">ESPACE SÉCURISÉ</span><h2>{t.signIn}</h2>
        <label>{t.email}<input name="email" type="email" autoComplete="username" required placeholder="nom@organisation.tn" /></label>
        <label>{t.password}<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button" type="submit">{t.connect}<ChevronRight size={18} /></button>
      </form>
    </section> : <>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={20} /></div><div><b>GCT</b><small>Suivi des dossiers</small></div></div>
        <span className="nav-caption">PILOTAGE</span>
        <nav aria-label="Navigation principale">
          <NavButton active={view === 'dashboard'} icon={<LayoutDashboard size={18} />} text={t.dashboard} onClick={() => setView('dashboard')} />
          <NavButton active={view === 'tenders'} icon={<FileText size={18} />} text={t.tenders} onClick={() => setView('tenders')} />
          <NavButton active={view === 'contracts'} icon={<BriefcaseBusiness size={18} />} text={t.contracts} onClick={() => setView('contracts')} />
        </nav>
        <div className="sidebar-foot"><span className="online-dot" /> Système opérationnel</div>
      </aside>
      <section className="workspace">
        <header className="topbar"><div className="crumb"><Activity size={16} /> GCT <ChevronRight size={14} /> {view === 'dashboard' ? t.dashboard : view === 'tenders' ? t.tenders : t.contracts}</div><div className="top-actions"><button className="icon-button" title="Changer de langue" aria-label="Changer de langue" onClick={() => setLanguage(rtl ? 'fr' : 'ar')}><Globe2 size={18} /><span>{rtl ? 'FR' : 'AR'}</span></button><div className="user-chip"><CircleUserRound size={18} /><span>{user.fullName}</span></div><button className="icon-button" title={t.exit} aria-label={t.exit} onClick={logout}><LogOut size={17} /></button></div></header>
        <div className="content-area">{view === 'dashboard' ? <Dashboard api={api} t={t} onOpen={() => setView('tenders')} /> : <DataList key={view} kind={view} api={api} t={t} />}</div>
      </section>
    </>}
  </main>;
}

function NavButton({ active, icon, text, onClick }: { active: boolean; icon: React.ReactNode; text: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{text}</span>{active && <span className="nav-indicator" />}</button>;
}

function Dashboard({ api, t, onOpen }: { api: <T>(path: string, init?: RequestInit) => Promise<T>; t: typeof labels.fr; onOpen: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<Stats>('/dashboard/stats').then(setStats).catch((cause) => setError(cause.message)); }, []);
  const chartConfig = [
    ['dossiersByStatus', 'Dossiers par statut'], ['contractsByState', 'Contrats en cours'],
    ['dossiersByExpenseNature', 'Répartition par nature'], ['dossiersByProcedure', 'Procédures d’achat'],
  ] as const;
  return <>
    <div className="page-heading"><div><span className="eyebrow">ESPACE DE PILOTAGE / 2026</span><h1>{t.dashboard}</h1><p>Vue consolidée des achats et de l’avancement des dossiers</p></div><div className="date-stamp">SUIVI · TEMPS RÉEL</div></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <button className={`alert-banner ${stats?.alerts.overdueCount ? 'has-alert' : ''}`} onClick={onOpen}><span className="alert-symbol"><AlertTriangle size={21} /></span><span><b>{stats?.alerts.overdueCount ?? '—'} {t.alert}</b><small>{t.recent}</small></span><ChevronRight className="alert-arrow" size={19} /></button>
    <div className="chart-grid">{chartConfig.map(([key, title], index) => <section className="chart-panel" key={key}><header><span className="chart-index">0{index + 1}</span><h2>{title}</h2></header><div className="chart-content">{stats ? <><ResponsiveContainer width="100%" height={176}><PieChart><Pie data={stats.charts[key]} dataKey="value" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">{stats.charts[key].map((entry, i) => <Cell key={`${entry.label}-${i}`} fill={colors[i % colors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="chart-legend">{stats.charts[key].slice(0, 4).map((entry, i) => <span key={entry.label}><i style={{ background: colors[i % colors.length] }} />{entry.label}<b>{entry.value}</b></span>)}</div></> : <div className="chart-loading">Chargement des indicateurs…</div>}</div></section>)}</div>
  </>;
}

function DataList({ kind, api, t }: { kind: 'tenders' | 'contracts'; api: <T>(path: string, init?: RequestInit) => Promise<T>; t: typeof labels.fr }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<ListResult | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const isContracts = kind === 'contracts';
  const endpoint = isContracts ? '/contracts' : '/dossiers';
  useEffect(() => { api<ListResult>(`${endpoint}?page=${page}&pageSize=10&q=${encodeURIComponent(query)}${status ? `&status=${encodeURIComponent(status)}` : ''}`).then(setData).catch((cause) => setError(cause.message)); }, [page, query, status]);
  const exportCsv = async () => {
    try {
      const blob = await api<Blob>(`${endpoint}?export=csv${query ? `&q=${encodeURIComponent(query)}` : ''}${status ? `&status=${encodeURIComponent(status)}` : ''}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${kind}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
  };
  const columns = isContracts ? [['contract_number', 'N° contrat'], ['subject', t.subject], ['holder', 'Titulaire'], ['state', t.status], ['date_effective', 'Mise en vigueur']] : [['reference', t.tenderRef], ['subject', t.subject], ['owner_name', 'Responsable'], ['status', t.status], ['submission_deadline', t.deadline]];
  return <>
    <div className="page-heading"><div><span className="eyebrow">REGISTRE / CONSULTATION</span><h1>{isContracts ? t.contracts : t.tenders}</h1><p>{data?.pagination.total ?? '—'} dossiers référencés</p></div><button className="secondary-button" onClick={exportCsv}><ArrowDownToLine size={17} />{t.export}</button></div>
    <div className="list-toolbar"><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} placeholder={t.search} aria-label={t.search} /></label><label className="status-filter"><span>{t.status}</span><select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} aria-label={t.status}><option value="">{t.filterStatus}</option>{(isContracts ? ['pending', 'in_progress', 'active', 'archived', 'cancelled'] : ['draft', 'published', 'evaluation', 'awarded', 'unsuccessful', 'cancelled']).map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="table-wrap"><table><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}{isContracts && <th>Action</th>}</tr></thead><tbody>{data?.data.length ? data.data.map((row) => <tr key={row.id}><>{columns.map(([key]) => <td key={key}>{String(row[key] ?? '—')}</td>)}{isContracts && <td><button className="table-action" onClick={() => setSelected(row)} aria-label={`${t.tracking}: ${row.contract_number}`}><ChevronRight size={17} /></button></td>}</></tr>) : <tr><td colSpan={columns.length + Number(isContracts)} className="empty-state">{data ? t.noRows : 'Chargement…'}</td></tr>}</tbody></table></div>
    <footer className="table-footer"><span>Page {data?.pagination.page ?? page} / {data?.pagination.pages ?? '—'}</span><div><button className="secondary-button small" disabled={page <= 1} onClick={() => setPage(page - 1)}><ArrowLeft size={15} />{t.previous}</button><button className="secondary-button small" disabled={!data || page >= data.pagination.pages} onClick={() => setPage(page + 1)}>{t.next}<ChevronRight size={15} /></button></div></footer>
    {selected && <ContractDialog row={selected} api={api} t={t} onClose={() => setSelected(null)} />}
  </>;
}

const trackingFields = [
  ['date_first_legal_document', 'Première pièce légale'], ['date_send_admin_signature', 'Envoi signature administration'],
  ['date_admin_signed_return', 'Retour signé administration'], ['date_send_client_signature', 'Envoi signature titulaire'],
  ['date_client_signed_return', 'Retour signé titulaire'], ['date_send_registration', 'Envoi enregistrement'],
  ['date_registered_return', 'Retour enregistré'], ['date_effective', 'Mise en vigueur'], ['date_archived', 'Archivage'],
] as const;
function ContractDialog({ row, api, t, onClose }: { row: Row; api: <T>(path: string, init?: RequestInit) => Promise<T>; t: typeof labels.fr; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(trackingFields.map(([key]) => [key, form.get(key) || null]));
    try { await api(`/contracts/${row.id}/tracking`, { method: 'PATCH', body: JSON.stringify(values) }); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><form className="tracking-modal" onSubmit={save}><header><div><span className="eyebrow">{row.contract_number}</span><h2>{t.tracking}</h2><p>{row.subject}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label={t.close}>×</button></header><div className="date-grid">{trackingFields.map(([key, label]) => <label key={key}>{label}<input type="date" name={key} defaultValue={String(row[key] || '').slice(0, 10)} /></label>)}</div>{error && <p className="error-message" role="alert">{error}</p>}<footer><button type="button" className="secondary-button" onClick={onClose}>{t.close}</button><button className="primary-button" disabled={saving}>{saving ? '…' : t.save}</button></footer></form></div>;
}

export default App;
