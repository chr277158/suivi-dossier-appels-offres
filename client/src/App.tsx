import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, ArrowLeft, Bell, Bird, BookOpen, BriefcaseBusiness, CalendarDays, CheckCheck, ChevronRight, CircleUserRound, ClipboardList, FileText, Globe2, GripVertical, History, LayoutDashboard, LogOut, Moon, Plus, Printer, Search, Settings2, ShieldCheck, Sun, Trash2, Users, X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { OvertimePage, UserAccountsPage } from './HrManagement';
import { DossiersPage } from './DossiersPage';
import { DossiersAvecAnomalie } from './DossiersAvecAnomalie';
import { CurrentTendersPage } from './CurrentTendersPage';
import { PurchasingGuidePage } from './PurchasingGuidePage';
import { PurchasingManualPage } from './PurchasingManualPage';
import { translations } from './i18n';
import type { Labels, Language } from './i18n';
import { DateInput, formatDate, formatDateTime, formatDateValue } from './date-format';
import { defaultReferenceRules, expectedCommission, formatReference, isReferenceMaskValid, referenceRuleWarning, requestTypeValues, suggestContractNumber, type ReferenceRules } from './reference-rules';
import './modules.css';
import './sidebar.css';
import './dashboard-details.css';
import './calendar-view.css';
import './theme.css';
import './settings.css';
import './reference-rules.css';
import './notifications.css';
import './reminder-sharing.css';
import './leaves.css';

type User = { id: number; email: string; fullName: string; role: string };
type AuthSession = { accessToken: string; user: User };
let refreshInFlight: Promise<AuthSession | null> | null = null;
type EditLink = { kind: 'dossiers' | 'contracts'; id: number };
type AppView = 'dashboard' | 'tenders' | 'currentTenders' | 'purchasingGuide' | 'purchasingManual' | 'anomalies' | 'contracts' | 'calendar' | 'surveillance' | 'reminders' | 'annual' | 'workPlan' | 'overtime' | 'leaves' | 'changeLog' | 'users' | 'settings';
type Row = Record<string, string | number | boolean | null> & { id?: string | number | null };
type SelectOption = { id: number; list_key: string; option_value: string; label_fr: string; label_ar: string; sort_order: number; is_active?: boolean };
type Stats = { charts: Record<string, { label: string; value: number }[]>; alerts: { overdueCount: number; overdueDossiers: Row[] } };
type ListResult = { data: Row[]; pagination: { page: number; pageSize: number; total: number; pages: number } };
type SurveillanceRule = { key: string; label: string; sourceField: string; sourceLabel: string; delay: number; unit: 'calendar_days' | 'business_days' | 'calendar_months'; enabled: boolean; applicableTo: string[] };
type SurveillanceRuleSet = { version: string; alertDaysBefore: number[]; overdueRepeatDays: number; holidays: string[]; rules: SurveillanceRule[] };

function decodeVapidPublicKey(publicKey: string): ArrayBuffer {
  const padding = '='.repeat((4 - publicKey.length % 4) % 4);
  const base64 = `${publicKey}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return buffer;
}

function getPushSubscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('Le navigateur a fourni un abonnement Push incomplet.');
  }
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

const API = import.meta.env.VITE_API_BASE || '';
const colors = ['#183e38', '#d16c4b', '#d8a83e', '#6b8474', '#8d9f91', '#afc4b2'];
const labels: Record<Language, Labels> = translations;
const viewLabels: Record<AppView, keyof typeof labels.fr> = { dashboard: 'dashboard', tenders: 'tenders', currentTenders: 'currentTenders', purchasingGuide: 'purchasingGuide', purchasingManual: 'purchasingManual', anomalies: 'anomalies', contracts: 'contracts', calendar: 'calendar', surveillance: 'surveillance', reminders: 'reminders', annual: 'annual', workPlan: 'workPlan', overtime: 'overtime', leaves: 'leaves', changeLog: 'changeLog', users: 'users', settings: 'settings' };
function statusLabel(value: string, t: Labels, options: SelectOption[] = []) {
  const map: Record<string, string> = {
    draft: t.statusDraft, published: t.statusPublished, evaluation: t.statusEvaluation,
    awarded: t.statusAwarded, unsuccessful: t.statusUnsuccessful, cancelled: t.statusCancelled,
    pending: t.statusPending, in_progress: t.statusInProgress, active: t.statusActive, archived: t.statusArchived,
  };
  const dynamic = options.find((option) => option.option_value === value && ['dossier_status', 'contract_state'].includes(option.list_key));
  return dynamic ? (t === labels.ar ? dynamic.label_ar : dynamic.label_fr) : map[value] ?? value;
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formattedDateTime(value: unknown, language: Language) {
  void language;
  return formatDateTime(value ? String(value) : null);
}

async function readJson<T>(response: Response, fallback: string, language: 'fr' | 'ar' = 'fr'): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    throw new Error(language === 'ar' ? fallback : `Réponse non JSON de l’API (HTTP ${response.status}). Vérifie /api/health et le routage Vercel.`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(language === 'ar' ? fallback : payload?.error || fallback);
  if (payload === null) throw new Error(language === 'ar' ? fallback : 'Réponse JSON invalide de l’API.');
  return payload as T;
}

function App() {
  const [language, setLanguage] = useState<'fr' | 'ar'>('fr');
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<AppView>('dashboard');
  const [editLink, setEditLink] = useState<EditLink | null>(null);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [ignoredAnomalies, setIgnoredAnomalies] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('gct-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* Use the system preference when storage is unavailable. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [notifications, setNotifications] = useState<Row[]>([]);
  const t = labels[language];
  const rtl = language === 'ar';
  const currentView: AppView = view === 'dashboard' && user?.role === 'reader' ? 'tenders' : view;

  const openView = useCallback((nextView: AppView) => {
    setView(nextView);
  }, []);

  useEffect(() => {
    const readEditLink = () => {
      if (window.location.hash === '#/reminders') {
        setView('reminders');
        return;
      }
      if (window.location.hash === '#/surveillance') {
        setView('surveillance');
        return;
      }
      const match = window.location.hash.match(/^#\/(dossiers|contracts)\/(\d+)\/edit$/);
      if (!match) return;
      const link = { kind: match[1] as EditLink['kind'], id: Number(match[2]) };
      setEditLink(link);
      setView(link.kind === 'dossiers' ? 'tenders' : 'contracts');
    };
    readEditLink();
    window.addEventListener('hashchange', readEditLink);
    return () => window.removeEventListener('hashchange', readEditLink);
  }, []);

  const clearEditLink = useCallback(() => {
    setEditLink(null);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${API}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (response) => response.ok ? readJson<{ accessToken: string; user: User }>(response, t.failure) : null)
      .then((session) => {
        if (cancelled) return;
        if (session) {
          setToken(session.accessToken);
          setUser(session.user);
        }
        setAuthReady(true);
      })
      .catch(() => { if (!cancelled) setAuthReady(true); });
    return () => { cancelled = true; };
  }, []);

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const request = (accessToken: string) => fetch(`${API}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
    });
    let response = await request(token);
    if (response.status === 401 && path !== '/auth/refresh' && path !== '/auth/logout') {
      const refreshOnce = async () => {
        const refreshed = await fetch(`${API}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
        return refreshed.ok ? readJson<AuthSession>(refreshed, t.failure) : null;
      };
      const pending = refreshInFlight ?? (refreshInFlight = (async () => {
        try {
          const locks = (navigator as Navigator & { locks?: { request<T>(name: string, callback: () => Promise<T>): Promise<T> } }).locks;
          return locks ? await locks.request('gct-auth-refresh', refreshOnce) : await refreshOnce();
        } catch { return null; }
      })());
      const session = await pending;
      if (refreshInFlight === pending) refreshInFlight = null;
      if (session) {
        setToken(session.accessToken);
        setUser(session.user);
        response = await request(session.accessToken);
      } else {
        setToken('');
        setUser(null);
      }
    }
    if (response.status === 204) return undefined as T;
    if (response.headers.get('content-type')?.includes('text/csv')) return await response.blob() as T;
    return readJson<T>(response, t.failure, language);
  }

  const apiRef = useRef(api);
  apiRef.current = api;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('gct-theme', theme); } catch { /* Theme remains active for this session. */ }
  }, [theme]);

  useEffect(() => {
    if (!user) { setOptions([]); return; }
    let cancelled = false;
    void apiRef.current<{ data: SelectOption[] }>('/options').then((result) => {
      if (!cancelled) setOptions(result.data);
    }).catch(() => { if (!cancelled) setOptions([]); });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    setIgnoredAnomalies({});
  }, [user?.id]);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    let active = true;
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const deliver = async (reminder: Row) => {
      if (!active) return;
      if (reminder.type === 'business') return;
      if (reminder.visible_until && String(reminder.visible_until).slice(0, 10) < localDateValue(new Date())) return;
      const title = String(reminder.title ?? t.reminders);
      const details = String(reminder.details ?? '');
      if (reminder.has_push_subscription && Number(reminder.delivery_attempts ?? 0) < 5) return;
      if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body: details });
      else window.alert(`${title}${details ? `\n${details}` : ''}`);
      try { await apiRef.current(`/reminders/${Number(reminder.id)}/sent`, { method: 'POST' }); }
      catch { timers.delete(Number(reminder.id)); }
    };
    const schedule = (reminder: Row) => {
      const id = Number(reminder.id);
      if (reminder.type === 'business' || !id || reminder.is_sent || timers.has(id)) return;
      const delay = new Date(String(reminder.reminder_at)).getTime() - Number(reminder.lead_minutes ?? 0) * 60_000 - Date.now();
      const timer = setTimeout(() => {
        timers.delete(id);
        if (Date.now() < new Date(String(reminder.reminder_at)).getTime() - Number(reminder.lead_minutes ?? 0) * 60_000) schedule(reminder);
        else void deliver(reminder);
      }, Math.max(0, Math.min(delay, 2147483647)));
      timers.set(id, timer);
    };
    const sync = async () => {
      try {
        const result = await apiRef.current<{ data: Row[] }>('/reminders');
        if (active) {
          setNotifications(result.data);
          const manualReminders = result.data.filter((item) => item.type !== 'business');
          const activeReminderIds = new Set(manualReminders.map((item) => Number(item.id)));
          timers.forEach((timer, id) => {
            if (!activeReminderIds.has(id)) { clearTimeout(timer); timers.delete(id); }
          });
          manualReminders.forEach(schedule);
        }
      } catch { /* Session refresh or the next sync will retry. */ }
    };
    void sync();
    const interval = setInterval(() => { void sync(); }, 60000);
    return () => {
      active = false;
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [user?.id, t.reminders]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API}/api/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password') }) });
      const result = await readJson<{ accessToken: string; user: User }>(response, t.failure, language);
      setToken(result.accessToken);
      setUser(result.user);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
  }

  async function logout() {
    try {
      await refreshInFlight?.catch(() => null);
      await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    }
    catch { /* Clear local credentials even if the network is unavailable. */ }
    finally { refreshInFlight = null; setToken(''); setUser(null); setIgnoredAnomalies({}); }
  }

  if (!authReady) return <main className="app-shell" lang={language} dir={rtl ? 'rtl' : 'ltr'}><section className="login-screen"><div className="login-form auth-loading" role="status">{t.sessionRestoring}</div></section></main>;

  const navigation: { id: AppView; icon: React.ReactNode }[] = [
    ...(user?.role === 'admin' || user?.role === 'manager' ? [{ id: 'dashboard' as const, icon: <LayoutDashboard size={18} /> }] : []),
    { id: 'tenders', icon: <FileText size={18} /> },
    { id: 'currentTenders', icon: <ClipboardList size={18} /> },
    { id: 'anomalies', icon: <AlertTriangle size={18} /> },
    { id: 'contracts', icon: <BriefcaseBusiness size={18} /> },
    { id: 'calendar', icon: <CalendarDays size={18} /> },
    { id: 'surveillance', icon: <Bell size={18} /> },
    { id: 'reminders', icon: <Bell size={18} /> },
    { id: 'annual', icon: <ClipboardList size={18} /> },
    { id: 'workPlan', icon: <ClipboardList size={18} /> },
    { id: 'overtime', icon: <Activity size={18} /> },
    { id: 'leaves', icon: <CalendarDays size={18} /> },
    ...(user?.role === 'admin' ? [{ id: 'changeLog' as const, icon: <History size={18} /> }] : []),
    ...(user?.role === 'admin' ? [{ id: 'users' as const, icon: <Users size={18} /> }] : []),
    ...(user?.role === 'admin' ? [{ id: 'settings' as const, icon: <Settings2 size={18} /> }] : []),
  ];
  const currentTitle = t[viewLabels[currentView]];

  return <main className="app-shell" lang={language} dir={rtl ? 'rtl' : 'ltr'}>
    {!user ? <section className="login-screen">
      <div className="login-art"><span className="eyebrow">GCT · {t.tenders}</span><h1>{t.hello}</h1><p>{t.subtitle}</p><div className="art-mark"><FileText size={84} strokeWidth={1} /></div></div>
      <form className="login-form" onSubmit={login}>
        <button className="language-switch" type="button" onClick={() => setLanguage(rtl ? 'fr' : 'ar')}><Globe2 size={17} /> {rtl ? 'FR' : 'عربي'}</button>
        <div className="brand-mark"><ShieldCheck size={20} /></div><span className="eyebrow">{t.secureSpace}</span><h2>{t.signIn}</h2>
        <label>{t.matricule}<input name="identifier" type="text" autoComplete="username" required placeholder={t.matriculePlaceholder} /></label>
        <label>{t.password}<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button" type="submit">{t.connect}<ChevronRight size={18} /></button>
      </form>
    </section> : <>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={20} /></div><div><b>GCT</b><small>{t.hello}</small></div></div>
        <span className="nav-caption">{t.pilotage}</span>
        <nav aria-label={t.navMain}>
          {navigation.map(({ id, icon }) => <NavButton key={id} active={currentView === id} icon={icon} text={t[viewLabels[id]]} onClick={() => openView(id)} />)}
        </nav>
        <div className="sidebar-foot"><div className="sidebar-status"><span className="online-dot" /> {t.operational}</div><NavButton active={currentView === 'purchasingGuide' || currentView === 'purchasingManual'} icon={<BookOpen size={18} />} text={t[viewLabels.purchasingGuide]} onClick={() => openView('purchasingGuide')} /></div>
      </aside>
      <section className="workspace">
        <header className="topbar"><div className="crumb"><Activity size={16} /> GCT <ChevronRight size={14} /> {currentTitle}</div><div className="top-actions"><NotificationCenter notifications={notifications} setNotifications={setNotifications} api={api} t={t} /><button className="icon-button" title={theme === 'dark' ? t.lightTheme : t.darkTheme} aria-label={theme === 'dark' ? t.lightTheme : t.darkTheme} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button" title="Changer de langue" aria-label="Changer de langue" onClick={() => setLanguage(rtl ? 'fr' : 'ar')}><Globe2 size={18} /><span>{rtl ? 'FR' : 'AR'}</span></button><div className="user-chip"><CircleUserRound size={18} /><span>{user.fullName}</span></div><button className="icon-button" title={t.exit} aria-label={t.exit} onClick={logout}><LogOut size={17} /></button></div></header>
        <div className="content-area">{currentView === 'dashboard' ? <Dashboard api={api} t={t} language={language} onOpen={() => openView('tenders')} options={options} /> : currentView === 'purchasingGuide' ? <PurchasingGuidePage language={language} onOpenManual={() => openView('purchasingManual')} /> : currentView === 'purchasingManual' ? <PurchasingManualPage language={language} onBack={() => openView('purchasingGuide')} /> : currentView === 'surveillance' ? <SurveillancePage api={api} t={t} language={language} canWrite={['admin', 'manager'].includes(user.role)} /> : currentView === 'anomalies' ? <DossiersAvecAnomalie api={api} t={t} onCorrect={(id) => { window.location.hash = `#/dossiers/${id}/edit`; }} canCorrect={['admin', 'manager'].includes(user.role)} currentUserId={user.id} canIgnore={['admin', 'manager'].includes(user.role)} ignored={ignoredAnomalies} onIgnoredChange={(key, value) => setIgnoredAnomalies((current) => ({ ...current, [key]: value }))} /> : currentView === 'tenders' ? <DossiersPage api={api} t={t} language={language} initialEditId={editLink?.kind === 'dossiers' ? editLink.id : null} onEditLinkConsumed={clearEditLink} canWrite={['admin', 'manager'].includes(user.role)} canCreate={['admin', 'manager'].includes(user.role)} canManageOwner={['admin', 'manager'].includes(user.role)} canDelete={user.role === 'admin'} userId={user.id} options={options} /> : currentView === 'currentTenders' ? <CurrentTendersPage api={api} t={t} language={language} /> : currentView === 'contracts' ? <DataList key={currentView} kind={currentView} api={api} t={t} language={language} initialEditId={editLink?.kind === 'contracts' ? editLink.id : null} onEditLinkConsumed={clearEditLink} canWrite={['admin', 'manager'].includes(user.role)} options={options} /> : currentView === 'settings' && user.role === 'admin' ? <SettingsPage api={api} t={t} language={language} onOptionsChanged={() => apiRef.current<{ data: SelectOption[] }>('/options').then((result) => setOptions(result.data))} /> : currentView === 'overtime' ? <OvertimePage api={api} t={t} user={user} language={language} /> : currentView === 'users' ? <UserAccountsPage api={api} t={t} language={language} /> : <ModulePage key={currentView} view={currentView} title={currentTitle} api={api} t={t} language={language} user={user} options={options} />}</div>
      </section>
    </>}
  </main>;
}

function NavButton({ active, icon, text, onClick }: { active: boolean; icon: React.ReactNode; text: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick} aria-label={text} title={text}>{icon}<span>{text}</span>{active && <span className="nav-indicator" />}</button>;
}

function NotificationCenter({ notifications, setNotifications, api, t }: { notifications: Row[]; setNotifications: (rows: Row[]) => void; api: <T>(path: string, init?: RequestInit) => Promise<T>; t: Labels }) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((item) => item.type !== 'business' && !item.is_read).length;

  async function markRead(row: Row) {
    if (row.is_read || row.type === 'business') return;
    try {
      await api(`/reminders/${Number(row.id)}/read`, { method: 'POST' });
      setNotifications(notifications.map((item) => Number(item.id) === Number(row.id) ? { ...item, is_read: true } : item));
    } catch { /* The next reminder sync will refresh the notification state. */ }
  }

  async function markAllRead() {
    try {
      await api('/reminders/read-all', { method: 'POST' });
      setNotifications(notifications.map((item) => item.type === 'business' ? item : { ...item, is_read: true }));
    } catch { /* The next reminder sync will refresh the notification state. */ }
  }

  return <div className="notification-center">
    <button className="icon-button notification-trigger" title={t.notificationCenter} aria-label={`${t.notificationCenter}${unreadCount ? ` (${unreadCount})` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}><Bell size={18} />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
    {open && <section className="notification-popover" aria-label={t.notificationCenter}>
      <header><strong>{t.notificationCenter}</strong><button type="button" onClick={() => void markAllRead()} disabled={!unreadCount}><CheckCheck size={15} />{t.markAllRead}</button></header>
      <div className="notification-list">{notifications.length ? notifications.slice(0, 30).map((item) => <button className={`notification-item ${item.type !== 'business' && !item.is_read ? 'unread' : ''}`} key={String(item.id)} onClick={() => { void markRead(item); if (item.dossier_id) window.location.hash = `#/dossiers/${item.dossier_id}/edit`; else if (item.contract_id) window.location.hash = `#/contracts/${item.contract_id}/edit`; else if (item.annual_program_id) window.location.hash = '#/surveillance'; }}>
        <span className="notification-item-mark" />
        <span className="notification-item-content"><strong>{String(item.title ?? '')}</strong><span>{String(item.details ?? '')}</span><time>{formatDateTime(String(item.created_at ?? item.reminder_at))}</time></span>
      </button>) : <p className="notification-empty">{t.noUserNotifications}</p>}</div>
    </section>}
  </div>;
}

function SettingsPage({ api, t, language, onOptionsChanged }: { api: <T>(path: string, init?: RequestInit) => Promise<T>; t: Labels; language: Language; onOptionsChanged: () => void }) {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [referenceRules, setReferenceRules] = useState<ReferenceRules>(defaultReferenceRules);
  const [listKey, setListKey] = useState('expense_nature');
  const [form, setForm] = useState({ value: '', labelFr: '', labelAr: '' });
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rulesSaving, setRulesSaving] = useState(false);
  const listNames: Record<string, string> = {
    expense_nature: t.expenseNature, procedure_type: t.procedureType, committee: t.committee, currency: t.currency,
    dossier_status: t.dossierStatus, contract_state: t.contractState, reminder_importance: t.importance,
  };
  const listHelp: Record<string, string> = {
    expense_nature: t.settingsListHelpExpense, procedure_type: t.settingsListHelpProcedure, committee: t.settingsListHelpCommittee,
    currency: t.settingsListHelpCurrency, dossier_status: t.settingsListHelpDossierStatus, contract_state: t.settingsListHelpContractState,
    reminder_importance: t.settingsListHelpReminder,
  };
  const reload = async () => {
    try {
      const result = await api<{ data: SelectOption[] }>('/settings/options');
      setOptions(result.data);
      setError('');
    } catch (cause) { setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); }
  };
  useEffect(() => { void reload(); }, [api]);
  useEffect(() => {
    void api<{ data: ReferenceRules }>('/reference-rules')
      .then((result) => setReferenceRules(result.data))
      .catch((cause) => setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure));
  }, [api, language, t.failure]);
  const visible = options.filter((option) => option.list_key === listKey).sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);

  async function addOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api('/settings/options', { method: 'POST', body: JSON.stringify({ listKey, ...form, sortOrder: (visible.length + 1) * 10 }) });
      setForm({ value: '', labelFr: '', labelAr: '' });
      await reload();
      onOptionsChanged();
    } catch (cause) { setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); }
  }

  async function patchOption(option: SelectOption, patch: Record<string, string | number | boolean>) {
    setBusyId(option.id);
    setError('');
    try {
      await api(`/settings/options/${option.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      await reload();
      onOptionsChanged();
    } catch (cause) { setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); }
    finally { setBusyId(null); }
  }

  async function moveOption(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= visible.length) return;
    const reordered = [...visible];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await Promise.all(reordered.map((option, position) => api(`/settings/options/${option.id}`, { method: 'PATCH', body: JSON.stringify({ sortOrder: (position + 1) * 10 }) })));
      await reload();
      onOptionsChanged();
    } catch (cause) { setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); }
  }

  async function saveReferenceRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRulesSaving(true);
    setError('');
    try {
      const result = await api<{ data: ReferenceRules }>('/settings/reference-rules', {
        method: 'PUT',
        body: JSON.stringify(referenceRules),
      });
      setReferenceRules(result.data);
    } catch (cause) {
      setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure);
    } finally {
      setRulesSaving(false);
    }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t.admin}</span><h1>{t.settings}</h1><p>{t.settingsSubtitle}</p></div></div>
    <section className="settings-help" aria-labelledby="settings-guide-title">
      <h2 id="settings-guide-title">{t.settingsGuideTitle}</h2>
      <ol><li>{t.settingsGuideStepSelect}</li><li>{t.settingsGuideStepEdit}</li><li>{t.settingsGuideStepOrder}</li><li>{t.settingsGuideStepDisable}</li><li>{t.settingsGuideStepAdd}</li></ol>
    </section>
    <div className="settings-section-divider"><span>{language === 'ar' ? 'المراجع واللجان' : 'Références et commissions'}</span></div>
    <form className="reference-rules-settings" onSubmit={saveReferenceRules}>
      <header><div><h2>{t.referenceRulesTitle}</h2><p>{t.referenceRulesHelp}</p></div></header>
      <p className="settings-help-note">{t.settingsMaskExample}</p>
      <div className="reference-mask-grid">
        <label>{t.dossierReferenceMask}<input value={referenceRules.masks.dossier} onChange={(event) => setReferenceRules({ ...referenceRules, masks: { ...referenceRules.masks, dossier: event.target.value.toUpperCase() } })} required maxLength={40} /></label>
        <label>{t.contractNumberMask}<input value={referenceRules.masks.contract} onChange={(event) => setReferenceRules({ ...referenceRules, masks: { ...referenceRules.masks, contract: event.target.value.toUpperCase() } })} required maxLength={40} /></label>
        <label>{t.annualReferenceMask}<input value={referenceRules.masks.annual} onChange={(event) => setReferenceRules({ ...referenceRules, masks: { ...referenceRules.masks, annual: event.target.value.toUpperCase() } })} required maxLength={40} /></label>
      </div>
      <h3>{t.commissionThresholds}</h3>
      <div className="reference-threshold-grid">
        <strong>{t.studies}</strong>
        <label>{t.craBelow}<input type="number" min="0" step="0.001" value={referenceRules.thresholds.study.craMax} onChange={(event) => setReferenceRules({ ...referenceRules, thresholds: { ...referenceRules.thresholds, study: { ...referenceRules.thresholds.study, craMax: Number(event.target.value) } } })} required /></label>
        <label>{t.caeBelow}<input type="number" min="0" step="0.001" value={referenceRules.thresholds.study.caeMax} onChange={(event) => setReferenceRules({ ...referenceRules, thresholds: { ...referenceRules.thresholds, study: { ...referenceRules.thresholds.study, caeMax: Number(event.target.value) } } })} required /></label>
        <strong>{t.servicesGoods}</strong>
        <label>{t.craFrom}<input type="number" min="0" step="0.001" value={referenceRules.thresholds.servicesAndGoods.craMin} onChange={(event) => setReferenceRules({ ...referenceRules, thresholds: { ...referenceRules.thresholds, servicesAndGoods: { ...referenceRules.thresholds.servicesAndGoods, craMin: Number(event.target.value) } } })} required /></label>
        <label>{t.caeFrom}<input type="number" min="0" step="0.001" value={referenceRules.thresholds.servicesAndGoods.craMax} onChange={(event) => setReferenceRules({ ...referenceRules, thresholds: { ...referenceRules.thresholds, servicesAndGoods: { ...referenceRules.thresholds.servicesAndGoods, craMax: Number(event.target.value) } } })} required /></label>
        <label>{t.cmeFrom}<input type="number" min="0" step="0.001" value={referenceRules.thresholds.servicesAndGoods.caeMax} onChange={(event) => setReferenceRules({ ...referenceRules, thresholds: { ...referenceRules.thresholds, servicesAndGoods: { ...referenceRules.thresholds.servicesAndGoods, caeMax: Number(event.target.value) } } })} required /></label>
      </div>
      <p className="reference-rules-note">{t.referenceThresholdLogic}</p>
      <p className="settings-help-note">{t.settingsReferenceEffect}</p>
      <button className="primary-button" disabled={rulesSaving}>{rulesSaving ? t.saving : t.save}</button>
    </form>
    <div className="settings-section-divider"><span>{language === 'ar' ? 'قوائم الاختيار' : 'Listes de choix'}</span></div>
    <div className="settings-toolbar"><label>{t.selectList}<select value={listKey} onChange={(event) => setListKey(event.target.value)}>{Object.entries(listNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></div>
    <aside className="settings-list-help"><strong>{t.settingsListHelpTitle} · {listNames[listKey]}</strong><p>{listHelp[listKey]}</p></aside>
    {error && <p className="error-message" role="alert">{error}</p>}
    <section className="settings-option-list"><header><h2>{listNames[listKey]}</h2><span>{visible.filter((option) => option.is_active !== false).length} {t.activeOptions}</span></header>
      {visible.map((option, index) => <article className={!option.is_active ? 'is-disabled' : ''} key={option.id}><GripVertical size={16} /><div className="settings-option-value"><strong>{option.option_value}</strong><small>{t.internalValue}</small></div><label><span>{t.labelFrench}</span><input defaultValue={option.label_fr} onBlur={(event) => { if (event.target.value.trim() !== option.label_fr) void patchOption(option, { labelFr: event.target.value.trim() }); }} /></label><label><span>{t.labelArabic}</span><input dir="rtl" defaultValue={option.label_ar} onBlur={(event) => { if (event.target.value.trim() !== option.label_ar) void patchOption(option, { labelAr: event.target.value.trim() }); }} /></label><div className="settings-option-actions"><button className="icon-button" disabled={index === 0} aria-label={t.moveUp} onClick={() => void moveOption(index, -1)}><ArrowLeft size={16} /></button><button className="icon-button" disabled={index === visible.length - 1} aria-label={t.moveDown} onClick={() => void moveOption(index, 1)}><ChevronRight size={16} /></button><button className="icon-button" disabled={busyId === option.id} aria-label={option.is_active ? t.disableOption : t.enableOption} onClick={() => void patchOption(option, { isActive: !option.is_active })}>{option.is_active ? <Trash2 size={16} /> : <Plus size={16} />}</button></div></article>)}
    </section>
    <form className="settings-option-form" onSubmit={addOption}><h2>{t.addOption}</h2><div><label>{t.internalValue}<input value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} required maxLength={80} /><small>{t.settingsInternalValueHelp}</small></label><label>{t.labelFrench}<input value={form.labelFr} onChange={(event) => setForm({ ...form, labelFr: event.target.value })} required maxLength={120} /></label><label>{t.labelArabic}<input dir="rtl" value={form.labelAr} onChange={(event) => setForm({ ...form, labelAr: event.target.value })} required maxLength={120} /></label><button className="primary-button"><Plus size={16} />{t.addOption}</button></div></form>
    <div className="settings-section-divider"><span>{language === 'ar' ? 'متابعة آجال الشراء' : 'Surveillance des achats'}</span></div>
    <SurveillanceRulesEditor api={api} language={language} />
  </>;
}

function SurveillanceRulesEditor({ api, language }: { api: <T>(path: string, init?: RequestInit) => Promise<T>; language: Language }) {
  const [configuration, setConfiguration] = useState<SurveillanceRuleSet | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const isArabic = language === 'ar';
  useEffect(() => {
    void api<{ data: SurveillanceRuleSet }>('/settings/surveillance-rules')
      .then((result) => setConfiguration(result.data))
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Impossible de charger les règles.'));
  }, [api]);

  function patchRule(index: number, patch: Partial<SurveillanceRule>) {
    setConfiguration((current) => current ? { ...current, rules: current.rules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule) } : current);
    setSaved(false);
  }

  function addRule() {
    setConfiguration((current) => current ? { ...current, rules: [...current.rules, { key: `custom_${Date.now()}`, label: 'Nouvelle règle', sourceField: 'custom_event', sourceLabel: 'Date de départ à renseigner', delay: 1, unit: 'calendar_days', enabled: true, applicableTo: ['all'] }] } : current);
    setSaved(false);
  }

  function removeRule(index: number) {
    setConfiguration((current) => current && current.rules.length > 1 ? { ...current, rules: current.rules.filter((_, ruleIndex) => ruleIndex !== index) } : current);
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configuration) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await api<{ data: SurveillanceRuleSet }>('/settings/surveillance-rules', { method: 'PUT', body: JSON.stringify(configuration) });
      setConfiguration(result.data);
      setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer les règles.'); }
    finally { setSaving(false); }
  }

  return <form className="surveillance-settings" onSubmit={save}>
    <header><div><span className="eyebrow">{isArabic ? 'متابعة المشتريات' : 'SUIVI DES ACHATS'}</span><h2>{isArabic ? 'قواعد المواعيد والتنبيهات' : 'Règles des échéances et notifications'}</h2><p>{isArabic ? 'عدّل القواعد عندما يتغير دليل الشراء. تحفظ القواعد مع مرجع نسخته.' : 'Modifiez les délais si le manuel évolue. Les règles sont enregistrées avec la référence de leur version.'}</p></div><button type="button" className="secondary-button" onClick={addRule}><Plus size={16} />{isArabic ? 'إضافة قاعدة' : 'Ajouter une règle'}</button></header>
    {!configuration ? <p>{isArabic ? 'جار التحميل…' : 'Chargement des règles…'}</p> : <>
      <div className="surveillance-global-grid">
        <label>{isArabic ? 'مرجع الدليل' : 'Référence du manuel'}<input value={configuration.version} onChange={(event) => { setConfiguration({ ...configuration, version: event.target.value }); setSaved(false); }} required maxLength={80} /></label>
        <label>{isArabic ? 'بدء التنبيهات قبل الموعد بالأيام' : 'Anticipation des alertes (jours avant échéance)'}<input value={configuration.alertDaysBefore.join(', ')} onChange={(event) => { const days = event.target.value.split(',').map((part) => Number(part.trim())).filter((value) => Number.isInteger(value) && value >= 0 && value <= 365); setConfiguration({ ...configuration, alertDaysBefore: days }); setSaved(false); }} inputMode="numeric" /><small>Les alertes restent affichées jusqu’à la réalisation de l’échéance.</small></label>
        <label>{isArabic ? 'تكرار التذكير بعد التأخير (أيام)' : 'Répétition du rappel après échéance (jours)'}<input type="number" min="1" max="90" value={configuration.overdueRepeatDays} onChange={(event) => { setConfiguration({ ...configuration, overdueRepeatDays: Number(event.target.value) }); setSaved(false); }} required /></label>
        <label>{isArabic ? 'أيام العطل (AAAA-MM-JJ، مفصولة بفواصل)' : 'Jours fériés (AAAA-MM-JJ, séparés par des virgules)'}<input value={configuration.holidays.join(', ')} onChange={(event) => { const holidays = event.target.value.split(',').map((part) => part.trim()).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)); setConfiguration({ ...configuration, holidays }); setSaved(false); }} placeholder="2026-01-01, 2026-03-20" /></label>
      </div>
      <div className="surveillance-rule-list"><div className="surveillance-rule-heading"><span>{isArabic ? 'الحدث / القاعدة' : 'Événement / règle'}</span><span>{isArabic ? 'المدة والوحدة' : 'Délai et unité'}</span><span>{isArabic ? 'النطاق' : 'Applicabilité'}</span><span>{isArabic ? 'الحالة' : 'État'}</span></div>
        {configuration.rules.map((rule, index) => <article className="surveillance-rule-row" key={rule.key}>
          <div className="surveillance-rule-name"><strong>{rule.label}</strong><label>{isArabic ? 'تاريخ الانطلاق' : 'Événement de départ'}<input value={rule.sourceLabel} onChange={(event) => patchRule(index, { sourceLabel: event.target.value })} required /></label><label>{isArabic ? 'حقل الحدث' : 'Code du champ événement'}<input value={rule.sourceField} readOnly aria-readonly="true" /></label></div>
          <div className="surveillance-rule-duration"><label>{isArabic ? 'المدة' : 'Durée'}<input type="number" min="0" max="3650" value={rule.delay} onChange={(event) => patchRule(index, { delay: Number(event.target.value) })} required /></label><label>{isArabic ? 'الوحدة' : 'Unité'}<select value={rule.unit} onChange={(event) => patchRule(index, { unit: event.target.value as SurveillanceRule['unit'] })}><option value="calendar_days">Jours calendaires</option><option value="business_days">Jours ouvrables</option><option value="calendar_months">Mois calendaires</option></select></label></div>
          <label>{isArabic ? 'اللجنة / النطاق' : 'Commission / portée'}<select multiple size={3} value={rule.applicableTo} onChange={(event) => patchRule(index, { applicableTo: [...event.currentTarget.selectedOptions].map((option) => option.value) })}><option value="all">Tous les achats</option><option value="DAR">DAR</option><option value="CRA">CRA</option><option value="CAE">CAE</option><option value="CME">CME</option><option value="urgent">Urgence justifiée</option></select></label>
          <div className="surveillance-rule-actions"><label className="surveillance-rule-enabled"><input type="checkbox" checked={rule.enabled} onChange={(event) => patchRule(index, { enabled: event.target.checked })} />{isArabic ? 'مفعّل' : 'Activée'}</label><button type="button" className="icon-button" aria-label={isArabic ? 'حذف القاعدة' : 'Supprimer la règle'} disabled={configuration.rules.length <= 1} onClick={() => removeRule(index)}><Trash2 size={15} /></button></div>
        </article>)}
      </div>
      <div className="surveillance-save-row"><span role="status">{saved ? (isArabic ? 'تم الحفظ' : 'Paramètres enregistrés.') : ''}</span><button className="primary-button" disabled={saving}>{saving ? (isArabic ? 'جار الحفظ…' : 'Enregistrement…') : (isArabic ? 'حفظ القواعد' : 'Enregistrer les règles')}</button></div>
    </>}
    {error && <p className="error-message" role="alert">{error}</p>}
  </form>;
}

function SurveillancePage({ api, t, language, canWrite }: { api: <T>(path: string, init?: RequestInit) => Promise<T>; t: Labels; language: Language; canWrite: boolean }) {
  const [rules, setRules] = useState<SurveillanceRule[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [dossiers, setDossiers] = useState<Row[]>([]);
  const [contracts, setContracts] = useState<Row[]>([]);
  const [annualPrograms, setAnnualPrograms] = useState<Row[]>([]);
  const [target, setTarget] = useState<'dossier' | 'contract' | 'annual'>('dossier');
  const [form, setForm] = useState({ ruleKey: '', dossierId: '', contractId: '', annualProgramId: '', startedAt: '', completedAt: '', note: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isArabic = language === 'ar';
  const selectedRule = rules.find((rule) => rule.key === form.ruleKey);

  const reload = async () => {
    setLoading(true);
    try {
      const [ruleResult, eventResult] = await Promise.all([
        api<{ data: SurveillanceRuleSet }>('/surveillance/rules'),
        api<{ data: Row[] }>('/surveillance/events'),
      ]);
      setRules(ruleResult.data.rules.filter((rule) => rule.enabled));
      setEvents(eventResult.data);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [api]);
  useEffect(() => {
    if (!canWrite) return;
    void Promise.all([
      api<ListResult>('/dossiers?page=1&pageSize=100').then((result) => setDossiers(result.data)),
      api<ListResult>('/contracts?page=1&pageSize=100').then((result) => setContracts(result.data)),
      api<{ data: Row[]; year: number }>(`/planning/annual?year=${new Date().getFullYear()}`).then((result) => setAnnualPrograms(result.data)),
    ]).catch((cause) => setError(cause instanceof Error ? cause.message : t.failure));
  }, [api, canWrite]);
  useEffect(() => {
    if (rules.length && !rules.some((rule) => rule.key === form.ruleKey)) setForm((current) => ({ ...current, ruleKey: rules[0].key }));
  }, [rules, form.ruleKey]);

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/surveillance/events', { method: 'POST', body: JSON.stringify({ ruleKey: form.ruleKey, dossierId: target === 'dossier' ? Number(form.dossierId) : null, contractId: target === 'contract' ? Number(form.contractId) : null, annualProgramId: target === 'annual' ? Number(form.annualProgramId) : null, startedAt: form.startedAt, completedAt: form.completedAt || null, note: form.note.trim() || null }) });
      setForm((current) => ({ ...current, startedAt: '', completedAt: '', note: '' }));
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
    finally { setSaving(false); }
  }

  async function updateEvent(row: Row, completedAt: string) {
    try {
      await api(`/surveillance/events/${Number(row.id)}`, { method: 'PATCH', body: JSON.stringify({ completedAt: completedAt || null, note: row.note ? String(row.note) : null }) });
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t.surveillance.toUpperCase()}</span><h1>{t.surveillance}</h1><p>{isArabic ? 'سجّل تاريخ بداية كل أجل وتاريخ إنجازه. يعرض النظام تاريخ الاستحقاق والتنبيهات حسب القواعد الحالية.' : 'Enregistrez le point de départ et la réalisation de chaque délai. L’échéance et les alertes suivent les règles actuellement paramétrées.'}</p></div></div>
    {canWrite && <form className="surveillance-event-form" onSubmit={addEvent}>
      <h2>{isArabic ? 'إضافة أجل للمتابعة' : 'Ajouter une échéance à surveiller'}</h2>
      <aside className="surveillance-form-explanation"><strong>{isArabic ? 'تنبيه' : 'À savoir'}</strong><p>{isArabic ? 'يُحتسب تاريخ الاستحقاق بحسب القاعدة المختارة وتاريخ البداية. أدخل تاريخ الإنجاز لإقفال المتابعة وإيقاف التذكيرات.' : 'La date d’échéance est calculée selon la règle choisie et la date de départ. Renseignez la date de réalisation pour clôturer le suivi et arrêter les rappels.'}</p></aside>
      <div className="surveillance-event-grid">
        <label>{isArabic ? 'القاعدة' : 'Règle'}<select value={form.ruleKey} onChange={(event) => setForm({ ...form, ruleKey: event.target.value })} required>{rules.map((rule) => <option key={rule.key} value={rule.key}>{rule.label}</option>)}</select></label>
        <label>{isArabic ? 'نوع المتابعة' : 'Type de suivi'}<select value={target} onChange={(event) => setTarget(event.target.value as 'dossier' | 'contract' | 'annual') }><option value="dossier">{t.tenders}</option><option value="contract">{t.contracts}</option><option value="annual">{t.annual}</option></select></label>
        {target === 'dossier' ? <label>{isArabic ? 'الملف' : 'Dossier'}<select value={form.dossierId} onChange={(event) => setForm({ ...form, dossierId: event.target.value })} required><option value="">{isArabic ? 'اختر ملفاً' : 'Sélectionner un dossier'}</option>{dossiers.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.reference)} — {String(row.subject)}</option>)}</select></label>
          : target === 'contract' ? <label>{isArabic ? 'العقد' : 'Contrat'}<select value={form.contractId} onChange={(event) => setForm({ ...form, contractId: event.target.value })} required><option value="">{isArabic ? 'اختر عقداً' : 'Sélectionner un contrat'}</option>{contracts.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.contract_number)} — {String(row.subject)}</option>)}</select></label>
            : <label>{isArabic ? 'الخطة السنوية' : 'Plan annuel'}<select value={form.annualProgramId} onChange={(event) => setForm({ ...form, annualProgramId: event.target.value })} required><option value="">{isArabic ? 'اختر عملية' : 'Sélectionner une opération'}</option>{annualPrograms.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.reference)} — {String(row.subject)}</option>)}</select></label>}
        <label>{isArabic ? 'تاريخ البداية' : selectedRule?.sourceLabel ?? 'Date de départ'}<input type="date" value={form.startedAt} onChange={(event) => setForm({ ...form, startedAt: event.target.value })} required /></label>
        <label>{isArabic ? 'تاريخ الإنجاز (اختياري)' : 'Date de réalisation (facultative)'}<input type="date" value={form.completedAt} onChange={(event) => setForm({ ...form, completedAt: event.target.value })} /></label>
        <label className="surveillance-event-note">{isArabic ? 'ملاحظة / مرجع الإثبات' : 'Note ou référence de preuve'}<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} maxLength={2000} /></label>
        <button className="primary-button" disabled={saving || !rules.length}>{saving ? t.loading : t.create}</button>
      </div>
    </form>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <section className="surveillance-events">
      <header><h2>{isArabic ? 'الآجال المسجلة' : 'Échéances enregistrées'}</h2><span>{events.length} {isArabic ? 'أجل' : 'échéance(s)'}</span></header>
      {loading ? <p>{t.loading}</p> : events.length ? <div className="surveillance-event-list">{events.map((row) => {
        const finished = Boolean(row.completed_at);
        const ref = row.dossier_reference ?? row.contract_number ?? row.annual_reference ?? '—';
        const subject = row.dossier_subject ?? row.contract_subject ?? row.annual_subject ?? '';
        const due = row.due_date ? String(row.due_date).slice(0, 10) : '—';
        const late = !finished && due !== '—' && due < new Date().toISOString().slice(0, 10);
        return <article className={late ? 'is-overdue' : finished ? 'is-complete' : ''} key={String(row.id)}>
          <div><strong>{String(row.rule_label ?? row.rule_key)}</strong><a href={row.dossier_id ? `#/dossiers/${String(row.dossier_id)}/edit` : row.contract_id ? `#/contracts/${String(row.contract_id)}/edit` : '#/surveillance'}>{String(ref)} — {String(subject)}</a>{row.note && <small>{String(row.note)}</small>}</div>
          <div className="surveillance-event-dates"><span>{isArabic ? 'البداية' : 'Départ'} <b>{String(row.started_at).slice(0, 10)}</b></span><span>{isArabic ? 'الاستحقاق' : 'Échéance'} <b>{due}</b></span>{finished && <span>{isArabic ? 'الإنجاز' : 'Réalisée'} <b>{String(row.completed_at).slice(0, 10)}</b></span>}</div>
          {canWrite && <label className="surveillance-completion">{isArabic ? 'تاريخ الإنجاز' : 'Réalisation'}<input type="date" value={row.completed_at ? String(row.completed_at).slice(0, 10) : ''} onChange={(event) => void updateEvent(row, event.target.value)} /></label>}
          <span className={`surveillance-event-status ${late ? 'late' : finished ? 'done' : ''}`}>{late ? (isArabic ? 'متأخر' : 'En retard') : finished ? (isArabic ? 'منجز' : 'Réalisée') : (isArabic ? 'قيد المتابعة' : 'À suivre')}</span>
        </article>;
      })}</div> : <p className="surveillance-empty">{isArabic ? 'لا توجد آجال مسجلة بعد.' : 'Aucune échéance enregistrée pour le moment.'}</p>}
    </section>
  </>;
}

function Dashboard({ api, t, language, onOpen, options }: { api: <T>(path: string, init?: RequestInit) => Promise<T>; t: Labels; language: 'fr' | 'ar'; onOpen: () => void; options: SelectOption[] }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [deadlines, setDeadlines] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ chart: string; label: string; title: string } | null>(null);
  const [detailRows, setDetailRows] = useState<Row[] | null>(null);
  const [detailError, setDetailError] = useState('');
  useEffect(() => { api<Stats>('/dashboard/stats').then(setStats).catch(() => setError(t.failure)); }, [api, t.failure]);
  useEffect(() => {
    let active = true;
    const refreshDeadlines = () => {
      void api<{ data: Row[] }>('/dashboard/deadlines')
        .then((result) => { if (active) setDeadlines(result.data); })
        .catch(() => { if (active) setDeadlines([]); });
    };
    refreshDeadlines();
    const interval = setInterval(refreshDeadlines, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [api]);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setDetailRows(null);
    setDetailError('');
    void api<{ data: Row[] }>(`/dashboard/details?chart=${selected.chart}&label=${encodeURIComponent(selected.label)}`)
      .then((result) => { if (!cancelled) setDetailRows(result.data); })
      .catch(() => { if (!cancelled) setDetailError(t.failure); });
    return () => { cancelled = true; };
  }, [selected, api, t.failure]);
  const chartConfig = [
    ['dossiersByStatus', t.chartDossierStatus], ['contractsByState', t.chartContractsState],
    ['dossiersByExpenseNature', t.chartExpenseNature], ['dossiersByProcedure', t.chartProcedure],
  ] as const;
  return <>
    <div className="page-heading"><div><span className="eyebrow">{t.dashboardEyebrow}</span><h1>{t.dashboard}</h1><p>{t.dashboardSubtitle}</p></div><div className="date-stamp">{t.realtime}</div></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <button className={`alert-banner ${stats?.alerts.overdueCount ? 'has-alert' : ''}`} onClick={onOpen}><span className="alert-symbol"><AlertTriangle size={21} /></span><span><b>{stats?.alerts.overdueCount ?? '—'} {t.alert}</b><small>{t.recent}</small></span><ChevronRight className="alert-arrow" size={19} /></button>
    <section className="deadline-panel"><header><div><span className="eyebrow">{t.dashboardEyebrow}</span><h2>{t.upcomingDeadlines}</h2></div><span className="deadline-window">14 {t.dayCount}</span></header>
      {deadlines === null ? <p className="deadline-empty">{t.loading}</p> : deadlines.length ? <div className="deadline-list">{deadlines.map((row) => {
        const date = String(row.submission_deadline ?? '').slice(0, 10);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = date === localDateValue(tomorrow);
        return <article className={`deadline-row ${isTomorrow ? 'is-tomorrow' : ''}`} key={String(row.id)}>
          <div className="deadline-date">{isTomorrow && <span className="tomorrow-marker"><Bird size={16} /><span>{t.deadlineTomorrow}</span></span>}<time>{formatDate(date)}</time></div>
          <div className="deadline-description"><a href={`#/dossiers/${row.id}/edit`}>{String(row.reference ?? '—')}</a><strong>{String(row.subject ?? '—')}</strong></div>
          <span className="deadline-owner">{String(row.owner_name ?? t.notAssigned)}</span>
        </article>;
      })}</div> : <p className="deadline-empty">{t.noRows}</p>}
    </section>
    <div className="chart-grid">{chartConfig.map(([key, title], index) => <section className="chart-panel" key={key}><header><span className="chart-index">0{index + 1}</span><h2>{title}</h2><small>{t.viewDetails}</small></header><div className="chart-content">{stats ? <><ResponsiveContainer width="100%" height={176}><PieChart><Pie data={stats.charts[key]} dataKey="value" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">{stats.charts[key].map((entry, i) => <Cell key={`${entry.label}-${i}`} fill={colors[i % colors.length]} style={{ cursor: 'pointer' }} onClick={() => setSelected({ chart: key, label: entry.label, title })} />)}</Pie><Tooltip labelFormatter={(label) => statusLabel(String(label), t, options)} /></PieChart></ResponsiveContainer><div className="chart-legend">{stats.charts[key].slice(0, 4).map((entry, i) => <button type="button" key={entry.label} onClick={() => setSelected({ chart: key, label: entry.label, title })} aria-label={`${t.viewDetails}: ${statusLabel(entry.label, t, options)}`}><i style={{ background: colors[i % colors.length] }} />{statusLabel(entry.label, t, options)}<b>{new Intl.NumberFormat(language === 'ar' ? 'ar-TN' : 'fr-FR').format(entry.value)}</b></button>)}</div></> : <div className="chart-loading">{t.loading}</div>}</div></section>)}</div>
    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="chart-drilldown-modal" role="dialog" aria-modal="true" aria-labelledby="chart-detail-title" lang={language}><header><div><span className="eyebrow">{selected.title}</span><h2 id="chart-detail-title">{statusLabel(selected.label, t, options)}</h2><p>{detailRows ? `${detailRows.length} ${t.resultCount}` : t.loading}</p></div><button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label={t.close}><X size={18} /></button></header>{detailError && <p className="error-message" role="alert">{detailError}</p>}{detailRows === null && !detailError ? <div className="chart-detail-loading">{t.loading}</div> : detailRows?.length ? <div className="chart-detail-table"><table><thead><tr><th>{t.detailReference}</th><th>{t.detailSubject}</th><th>{t.detailOwner}</th><th>{t.detailStatus}</th><th>{t.detailDeadline}</th><th>{t.detailBudget}</th></tr></thead><tbody>{detailRows.map((row) => <tr key={row.id}><td><a href={`#/${selected.chart === 'contractsByState' ? 'contracts' : 'dossiers'}/${row.id}/edit`}>{String(row.reference ?? '—')}</a></td><td>{String(row.subject ?? '—')}</td><td>{String(row.owner_name ?? '—')}</td><td>{statusLabel(String(row.status ?? ''), t, options)}</td><td>{formattedDateTime(row.submission_deadline, language)}</td><td>{row.estimated_cost === null || row.estimated_cost === undefined ? '—' : `${Number(row.estimated_cost).toLocaleString(language === 'ar' ? 'ar-TN' : 'fr-FR')} ${String(row.currency ?? row.estimated_currency ?? 'TND')}`}</td></tr>)}</tbody></table></div> : <div className="chart-detail-loading">{t.noSegmentRecords}</div>}</section></div>}
  </>;
}

function DataList({ kind, api, t, language, initialEditId, onEditLinkConsumed, canWrite, options }: { kind: 'tenders' | 'contracts'; api: <T>(path: string, init?: RequestInit) => Promise<T>; t: Labels; language: 'fr' | 'ar'; initialEditId: number | null; onEditLinkConsumed: () => void; canWrite: boolean; options: SelectOption[] }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<ListResult | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [contractEditor, setContractEditor] = useState<Row | null>(null);
  const [reload, setReload] = useState(0);
  const isContracts = kind === 'contracts';
  const endpoint = isContracts ? '/contracts' : '/dossiers';
  useEffect(() => { api<ListResult>(`${endpoint}?page=${page}&pageSize=10&q=${encodeURIComponent(query)}${status ? `&status=${encodeURIComponent(status)}` : ''}`).then(setData).catch(() => setError(t.failure)); }, [page, query, status, endpoint, api, t.failure, reload]);
  useEffect(() => {
    if (initialEditId === null) return;
    if (!canWrite) {
      setError(t.failure);
      onEditLinkConsumed();
      return;
    }
    let cancelled = false;
    void api<{ data: Row }>(`/contracts/${initialEditId}`).then((result) => {
      if (cancelled) return;
      setContractEditor(result.data);
      onEditLinkConsumed();
    }).catch(() => {
      if (!cancelled) setError(t.failure);
      onEditLinkConsumed();
    });
    return () => { cancelled = true; };
  }, [initialEditId, canWrite, api, onEditLinkConsumed, t.failure]);
  const exportCsv = async () => {
    try {
      const blob = await api<Blob>(`${endpoint}?export=csv${query ? `&q=${encodeURIComponent(query)}` : ''}${status ? `&status=${encodeURIComponent(status)}` : ''}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${kind}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) { setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); }
  };
  const columns = isContracts ? [['contract_number', t.contractNumber], ['subject', t.subject], ['holder', t.holder], ['state', t.status], ['date_effective', t.effectiveDate]] : [['reference', t.tenderRef], ['subject', t.subject], ['owner_name', t.owner], ['status', t.status], ['submission_deadline', t.deadline]];
  return <>
    <div className="page-heading"><div><span className="eyebrow">{t.registry}</span><h1>{isContracts ? t.contracts : t.tenders}</h1><p>{data?.pagination.total ?? '—'} {t.recordCount}</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{isContracts && canWrite && <button className="primary-button" onClick={() => setContractEditor({ id: 'new', dossier_id: null, contract_number: '', subject: '', holder: null, amount: null, currency: 'TND', state: 'pending', ...Object.fromEntries(trackingFields.map(([key]) => [key, null])) })}><Plus size={17} />{t.addContract}</button>}<button className="secondary-button" onClick={exportCsv}><ArrowDownToLine size={17} />{t.export}</button></div></div>
    <div className="list-toolbar"><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} placeholder={t.search} aria-label={t.search} /></label><label className="status-filter"><span>{t.status}</span><select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} aria-label={t.status}><option value="">{t.filterStatus}</option>{options.filter((option) => option.list_key === (isContracts ? 'contract_state' : 'dossier_status') && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="table-wrap"><table><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}{isContracts && <th>{t.action}</th>}</tr></thead><tbody>{data?.data.length ? data.data.map((row) => <tr key={row.id}><>{columns.map(([key]) => <td key={key}>{key === 'contract_number' ? <a href={`#/contracts/${row.id}/edit`}>{String(row[key] ?? '—')}</a> : key === 'status' || key === 'state' ? statusLabel(String(row[key] ?? ''), t, options) : String(row[key] ?? '—')}</td>)}{isContracts && <td><button className="table-action" onClick={() => setSelected(row)} aria-label={`${t.tracking}: ${row.contract_number}`}><ChevronRight size={17} /></button></td>}</></tr>) : <tr><td colSpan={columns.length + Number(isContracts)} className="empty-state">{data ? t.noRows : t.loading}</td></tr>}</tbody></table></div>
    <footer className="table-footer"><span>{t.page} {data?.pagination.page ?? page} / {data?.pagination.pages ?? '—'}</span><div><button className="secondary-button small" disabled={page <= 1} onClick={() => setPage(page - 1)}><ArrowLeft size={15} />{t.previous}</button><button className="secondary-button small" disabled={!data || page >= data.pagination.pages} onClick={() => setPage(page + 1)}>{t.next}<ChevronRight size={15} /></button></div></footer>
    {selected && <ContractDialog row={selected} api={api} t={t} language={language} onClose={() => setSelected(null)} />}
    {contractEditor && <ContractEditor key={String(contractEditor.id)} row={contractEditor} isNew={contractEditor.id === 'new'} api={api} t={t} language={language} options={options} onClose={() => setContractEditor(null)} onSaved={() => { setContractEditor(null); setReload((value) => value + 1); }} />}
  </>;
}

function AnnualProgramForm({ rules, options, language, t, year, onCancel, onSave }: {
  rules: ReferenceRules; options: SelectOption[]; language: Language; t: Labels; year: number;
  onCancel: () => void; onSave: (payload: Record<string, string | number | null>) => Promise<void>;
}) {
  const [reference, setReference] = useState('');
  const [requestType, setRequestType] = useState('');
  const [committee, setCommittee] = useState('');
  const [budget, setBudget] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const expected = requestType && budget !== null ? expectedCommission(requestType, budget, rules) : null;
  const warning = referenceRuleWarning(requestType, budget, committee, reference, rules.masks.annual, rules, language);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isReferenceMaskValid(reference, rules.masks.annual)) {
      return;
    }
    if (warning) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await onSave({
        fiscal_year: year,
        reference,
        subject: String(form.get('subject') ?? ''),
        request_type: requestType,
        committee,
        procedure_type: String(form.get('procedure_type') ?? '') || null,
        estimated_cost: budget,
        funding_source: null,
        estimated_duration_days: null,
        estimated_start_date: null,
        estimated_announcement_date: null,
        estimated_opening_date: null,
      });
    } finally {
      setSaving(false);
    }
  }

  return <form className="annual-entry-form" onSubmit={submit}>
    <h2>{t.createAnnualEntry} · {year}</h2>
    <div className="annual-entry-grid">
      <label>{t.annualReference}<input value={reference} onChange={(event) => setReference(formatReference(event.target.value, rules.masks.annual, expected?.prefix))} required maxLength={80} /></label>
      <label>{t.subject}<input name="subject" required maxLength={500} /></label>
      <label>{t.requestCategory}<select value={requestType} onChange={(event) => setRequestType(event.target.value)} required><option value="">{t.selectOption}</option><option value={requestTypeValues.studies}>{t.requestTypeStudies}</option><option value={requestTypeValues.goodsAndServices}>{t.requestTypeGoodsServices}</option></select></label>
      <label>{t.cost}<input type="number" min="0" max="99999999999.999" step="0.001" value={budget ?? ''} onChange={(event) => setBudget(event.target.value === '' ? null : Number(event.target.value))} required /></label>
      <label>{t.committee}<select value={committee} onChange={(event) => setCommittee(event.target.value)} required><option value="">{t.selectOption}</option>{options.filter((option) => option.list_key === 'committee' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
      <label>{t.procedure}<input name="procedure_type" maxLength={120} /></label>
    </div>
    {warning && <p className="reference-rule-warning" role="alert">{warning}</p>}
    {expected && <p className="reference-rule-hint">{t.expectedCommittee}: {expected.commission} · {expected.prefix}</p>}
    {!warning && reference && !isReferenceMaskValid(reference, rules.masks.annual) && <p className="reference-rule-warning" role="alert">{t.referenceMaskWarning.replace('{mask}', rules.masks.annual)}</p>}
    <footer><button type="button" className="secondary-button" onClick={onCancel}>{t.cancel}</button><button className="primary-button" disabled={saving || Boolean(warning) || !isReferenceMaskValid(reference, rules.masks.annual)}>{saving ? t.saving : t.createAnnualEntry}</button></footer>
  </form>;
}

const moduleTables: Partial<Record<AppView, { endpoint: string; columns: [string, keyof Labels][] }>> = {
  calendar: { endpoint: '/calendar/events', columns: [['event_date', 'eventDate'], ['title', 'eventTitle'], ['kind', 'eventType']] },
  reminders: { endpoint: '/reminders', columns: [['title', 'title'], ['details', 'details'], ['reminder_at', 'date'], ['visible_until', 'visibleUntil'], ['importance', 'importance']] },
  annual: { endpoint: '/planning/annual', columns: [['reference', 'reference'], ['subject', 'subject'], ['request_type', 'requestType'], ['procedure_type', 'procedure'], ['estimated_cost', 'cost'], ['estimated_start_date', 'plannedStart']] },
  workPlan: { endpoint: '/planning/work-schedule', columns: [['title', 'title'], ['details', 'details'], ['start_date', 'startDate'], ['end_date', 'endDate'], ['status', 'state']] },
  overtime: { endpoint: '/overtime', columns: [['employee_label', 'employee'], ['work_date', 'date'], ['start_time', 'startTime'], ['end_time', 'endTime'], ['hours', 'hours'], ['comment', 'comment'], ['period', 'period']] },
  leaves: { endpoint: '/leaves', columns: [['employee_label', 'employee'], ['service_label', 'service'], ['leave_type', 'leaveType'], ['requested_days', 'days'], ['holidays', 'leaveOfficialHolidays'], ['start_date', 'startDate'], ['end_date', 'endDate'], ['balance_before', 'leavePreviousBalance'], ['balance_after', 'leaveCurrentBalance'], ['address_during_leave', 'leaveAddress'], ['telephone', 'phone'], ['status', 'state'], ['requested_at', 'requestedOn']] },
  changeLog: { endpoint: '/audit', columns: [['changed_at', 'changedOn'], ['actor', 'changedBy'], ['entity_name', 'module'], ['entity_id', 'entityRef'], ['action', 'action'], ['new_values', 'newValue'], ['summary', 'summary'], ['old_values', 'oldValue']] },
  users: { endpoint: '/users', columns: [['email', 'account'], ['full_name', 'name'], ['role', 'role'], ['is_active', 'active'], ['created_at', 'createdOn']] },
};

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'object' || Array.isArray(value)) return String(value);
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return '—';
  return entries.map(([field, nextValue]) => `${field}: ${nextValue === null ? '—' : typeof nextValue === 'string' ? nextValue : JSON.stringify(nextValue)}`).join('\n');
}

function PushNotificationsControl({ api, t }: { api: <T>(path: string, init?: RequestInit) => Promise<T>; t: Labels }) {
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'denied' | 'unavailable'>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadSubscription() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (active) setStatus('unavailable');
        return;
      }

      const { publicKey } = await api<{ publicKey: string | null }>('/notifications/push');
      if (!publicKey) {
        if (active) setStatus('unavailable');
        return;
      }
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api('/notifications/push', {
          method: 'POST',
          body: JSON.stringify(getPushSubscriptionPayload(subscription)),
        });
        if (active) setStatus('enabled');
      } else if (active) {
        setStatus(Notification.permission === 'denied' ? 'denied' : 'disabled');
      }
    }
    void loadSubscription().catch((cause: unknown) => {
      if (active) {
        setStatus('unavailable');
        setError(cause instanceof Error ? cause.message : t.failure);
      }
    });
    return () => { active = false; };
  }, [api, t.failure]);

  async function toggleSubscription() {
    setSaving(true);
    setError('');
    try {
      if (status === 'enabled') {
        const registration = await navigator.serviceWorker.getRegistration('/service-worker.js');
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await api('/notifications/push', {
            method: 'DELETE',
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
        }
        setStatus('disabled');
        return;
      }

      const { publicKey } = await api<{ publicKey: string | null }>('/notifications/push');
      if (!publicKey) throw new Error(t.pushUnavailable);
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'disabled');
        return;
      }
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(publicKey),
        });
      }
      await api('/notifications/push', {
        method: 'POST',
        body: JSON.stringify(getPushSubscriptionPayload(subscription)),
      });
      setStatus('enabled');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.failure);
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || status === 'loading' || status === 'unavailable' || status === 'denied';
  return <div className="push-notifications-control">
    <button type="button" className="secondary-button" onClick={() => void toggleSubscription()} disabled={disabled}>
      <Bell size={16} />
      {status === 'loading' ? t.pushLoading : status === 'enabled' ? t.pushDisable : status === 'unavailable' ? t.pushUnavailable : status === 'denied' ? t.pushDenied : t.pushEnable}
    </button>
    {error && <p className="error-message" role="alert">{error}</p>}
  </div>;
}

function printLeaveRequest(row: Row, language: Language) {
  void language;
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  const locale = 'ar-TN';
  const displayDate = (value: unknown) => {
    if (!value) return '';
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return escape(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).padStart(4, '0');
    return `${day}/${month}/${year}`;
  };
  const type = String(row.leave_type ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const has = (key: string) => type.includes(key) || (key === 'SOLDE' && (type.includes('PAID') || type.includes('ANNUEL'))) || (key === 'NON_SOLDE' && (type.includes('SANS SOLDE') || type.includes('UNPAID'))) || (key === 'AUTORISE' && String(row.status).toLowerCase() === 'approved');
  const tick = (key: string) => has(key) ? '☑' : '□';
  const number = (value: unknown) => value == null || value === '' ? '' : Number(value).toLocaleString(locale, { maximumFractionDigits: 2 });
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مطلب إجازة</title><style>
    @page{size:A4;margin:10mm}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#000;font-family:"Times New Roman",serif}body{direction:rtl}.sheet{width:190mm;min-height:277mm;padding:10mm;margin:0 auto;border:3px double #000}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8mm;font-size:13pt;font-weight:bold;line-height:1.5}.header-date{direction:rtl;white-space:nowrap}.title{text-align:center;font-size:22pt;font-style:italic;text-decoration:underline;font-weight:bold;margin:6mm 0}.checks{display:flex;justify-content:space-around;gap:5mm;direction:rtl;font-size:12pt;font-weight:bold;margin:7mm 0}.checks span{white-space:nowrap}.main{width:100%;border-collapse:collapse;font-size:13pt;font-weight:bold}.main td{padding:10pt 8pt;vertical-align:middle}.label{text-align:right;white-space:nowrap;width:20%}.value{text-align:right;min-width:25mm}.date{direction:ltr;text-align:right;unicode-bidi:isolate;white-space:nowrap}.line{display:inline-block;min-width:35mm;min-height:1em;border-bottom:1px dotted #444}.signatures{display:flex;justify-content:space-between;margin-top:22mm;font-size:13pt;font-weight:bold}.print-control{display:block;margin:10mm auto;padding:10px 24px;font:inherit;cursor:pointer}@media print{.sheet{width:auto;min-height:277mm;margin:0;border:3px double #000}.print-control{display:none}}
    </style></head><body><main class="sheet"><header class="header"><div><div>المجمع الكيميائي التونسي</div><div>الإدارة الجهوية للمعامل بقابس</div></div><div class="header-date">قابس في: <bdi dir="ltr">${escape(displayDate(row.requested_at))}</bdi></div></header>
    <h1 class="title">مطلب إجازة</h1><div class="checks"><span>${tick('SOLDE')} &nbsp; خالصة الأجر</span><span>${tick('NON_SOLDE')} &nbsp; غير خالصة الأجر</span><span>${tick('FAMIL')} &nbsp; لأسباب عائلية</span><span>${tick('AUTORISE')} &nbsp; مرخص فيها</span><span>${tick('COMPENS')} &nbsp; تعويض</span></div>
    <table class="main"><tbody><tr><td class="label">الاسم واللقب:</td><td class="value">${escape(row.employee_label)}</td><td class="label">الرقم الآلي:</td><td class="value">${escape(row.matricule)}</td></tr>
    <tr><td class="label">المصلحة:</td><td colspan="2">${escape(row.service_label || '')}</td><td class="label">المهنة:</td><td class="value">${escape(row.fonction)}</td></tr>
    <tr><td class="label">عدد الأيام المطلوبة:</td><td class="value">${escape(number(row.requested_days))}</td><td></td><td class="label" colspan="2">من ضمنها: ${escape(number(row.holidays))} أيام عطلة رسمية</td></tr>
    <tr><td class="label">تاريخ بداية الإجازة:</td><td class="date">${escape(displayDate(row.start_date))}</td><td></td><td class="label">تاريخ الرجوع:</td><td class="date">${escape(displayDate(row.end_date))}</td></tr>
    <tr><td class="label">الرصيد السابق:</td><td class="value">${escape(number(row.balance_before))}</td><td></td><td class="label">الرصيد الحالي:</td><td class="value">${escape(number(row.balance_after))}</td></tr>
    <tr><td class="label" colspan="2">العنوان أثناء الإجازة: ${escape(row.address_during_leave)} قابس</td><td></td><td class="label">رقم الهاتف:</td><td class="value">${escape(row.telephone)}</td></tr></tbody></table>
    <footer class="signatures"><span>إمضاء المعني بالأمر</span><span>إمضاء رئيس المصلحة</span></footer></main><button class="print-control" onclick="window.print()">طباعة</button></body></html>`;
  printWindow.document.open(); printWindow.document.write(html); printWindow.document.close(); printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function LeaveRequestForm({ t, service, onCancel, onSave }: { t: Labels; service: string; onCancel: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try { await onSave({ leaveType: form.get('leaveType'), startDate: form.get('startDate'), endDate: form.get('endDate'), holidays: Number(form.get('holidays') || 0), address: form.get('address'), telephone: form.get('telephone') }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation"><form className="tracking-modal leave-editor" onSubmit={submit}>
    <header><div><span className="eyebrow">{t.leaves}</span><h2>{t.newLeave}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label={t.close}><X size={18} /></button></header>
    <fieldset className="leave-types"><legend>{t.leaveType}</legend>{[['paid', t.leavePaid], ['unpaid', t.leaveUnpaid], ['family', t.leaveFamily], ['authorized', t.leaveAuthorized], ['compensatory', t.leaveCompensatory]].map(([value, label], index) => <label key={value}><input type="radio" name="leaveType" value={value} defaultChecked={index === 0} />{label}</label>)}</fieldset>
    <div className="hr-fields"><label>{t.service}<input value={service} readOnly /></label><label>{t.startDate}<DateInput name="startDate" required showPicker /></label><label>{t.leaveReturnDate}<DateInput name="endDate" required showPicker /></label><label>{t.leaveOfficialHolidays}<input name="holidays" type="number" min="0" step="1" defaultValue="0" /></label><label className="hr-field-wide">{t.leaveAddress}<input name="address" maxLength={500} /></label><label>{t.phone}<input name="telephone" maxLength={40} /></label></div>
    <p className="module-footnote">{t.leaveDayRule} {t.leaveBalanceRule}</p>{error && <p className="error-message" role="alert">{error}</p>}
    <footer><button type="button" className="secondary-button" onClick={onCancel}>{t.cancel}</button><button className="primary-button" disabled={busy}>{busy ? t.saving : t.saveEntry}</button></footer>
  </form></div>;
}

function CalendarView({ month, setMonth, events, reminders, error, t, language }: { month: Date; setMonth: (month: Date) => void; events: Row[]; reminders: Row[]; error: string; t: Labels; language: Language }) {
  const locale = language === 'ar' ? 'ar-TN' : 'fr-FR';
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
  const days = Array.from({ length: cellCount }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  const weekdays = Array.from({ length: 7 }, (_, index) => new Date(2026, 2, 2 + index).toLocaleDateString(locale, { weekday: 'short' }));
  const today = localDateValue(new Date());
  const eventsByDay = new Map<string, Row[]>();
  const remindersByDay = new Map<string, Row[]>();
  events.forEach((event) => {
    const date = String(event.event_date ?? '').slice(0, 10);
    eventsByDay.set(date, [...(eventsByDay.get(date) ?? []), event]);
  });
  reminders.filter((reminder) => reminder.reminder_at).forEach((reminder) => {
    const date = localDateValue(new Date(String(reminder.reminder_at)));
    if (date.slice(0, 7) === `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`) {
      remindersByDay.set(date, [...(remindersByDay.get(date) ?? []), reminder]);
    }
  });
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t.moduleEyebrow}</span><h1>{t.calendar}</h1><p>{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</p></div><div className="calendar-month-control"><button className="secondary-button small" onClick={() => setMonth(new Date())}>{t.today}</button><button className="icon-button" aria-label={t.previousMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ArrowLeft size={17} /></button><button className="icon-button" aria-label={t.nextMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="calendar-layout">
      <section className="month-calendar" aria-label={`${t.calendar}: ${month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`}>
        <div className="calendar-weekdays" role="row">{weekdays.map((weekday, index) => <div role="columnheader" key={`${weekday}-${index}`}>{weekday}</div>)}</div>
        <div className="calendar-days" role="grid">{days.map((day) => {
          const date = localDateValue(day);
          const dayEvents = eventsByDay.get(date) ?? [];
          const dayReminders = remindersByDay.get(date) ?? [];
          const currentMonth = date.slice(0, 7) === monthKey;
          return <div className={`calendar-day ${currentMonth ? '' : 'outside-month'} ${date === today ? 'is-today' : ''}`} role="gridcell" aria-label={day.toLocaleDateString(locale, { dateStyle: 'full' })} key={date}>
            <span className="calendar-day-number">{new Intl.NumberFormat(locale).format(day.getDate())}</span>
            <div className="calendar-day-items">
              {dayEvents.map((event, index) => <a className={`calendar-event ${event.kind === 'opening' ? 'event-opening' : 'event-contract-end'}`} href={String(event.link ?? '#')} key={`event-${String(event.id)}-${index}`} title={String(event.title ?? '')}><small>{event.kind === 'opening' ? `${t.eventOpening} · ${new Date(String(event.event_date).replace(' ', 'T')).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : t.eventContractEnd}</small><span>{String(event.title ?? '')}</span></a>)}
              {dayReminders.map((reminder, index) => <a className="calendar-event event-reminder" href={reminder.dossier_id ? `#/dossiers/${reminder.dossier_id}/edit` : '#/reminders'} key={`reminder-${String(reminder.id)}-${index}`} title={String(reminder.details ?? reminder.title ?? '')}><small>{new Date(String(reminder.reminder_at)).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small><span>{String(reminder.title ?? '')}</span></a>)}
            </div>
          </div>;
        })}</div>
      </section>
      <aside className="calendar-notifications"><h2>{t.notifications}</h2>{reminders.length ? reminders.map((reminder) => <article key={String(reminder.id)}><Bell size={15} /><div><strong>{String(reminder.title)}</strong><p>{String(reminder.details ?? '')}</p><time>{formatDateTime(String(reminder.reminder_at))}</time></div></article>) : <p className="empty-state">{t.noNotifications}</p>}</aside>
    </div>
  </>;
}

function ReminderForm({ options, assignees, userRole, t, language, onSubmit }: { options: SelectOption[]; assignees: { id: number; full_name: string }[]; userRole: string; t: Labels; language: Language; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [selectedRecipients, setSelectedRecipients] = useState<number[]>([]);
  const canTransmit = ['admin', 'manager'].includes(userRole);
  return <form className="reminder-form" onSubmit={onSubmit}>
    <label>{t.title}<input name="title" required maxLength={160} /></label>
    <label>{t.details}<textarea name="details" rows={2} /></label>
    <label>{t.dateTime}<DateInput name="reminderAt" dateTime required /></label>
    <label>{t.importance}<select name="importance">{options.filter((option) => option.list_key === 'reminder_importance' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
    {canTransmit && <fieldset className="reminder-recipients"><legend>{t.assignTo}</legend><div>{assignees.map((assignee) => <label key={assignee.id}><input type="checkbox" name="assignToUserIds" value={assignee.id} checked={selectedRecipients.includes(assignee.id)} onChange={() => setSelectedRecipients((current) => current.includes(assignee.id) ? current.filter((id) => id !== assignee.id) : [...current, assignee.id])} /><span>{assignee.full_name}</span></label>)}</div></fieldset>}
    {canTransmit && <label>{t.visibleUntil}<DateInput name="visibleUntil" required={selectedRecipients.length > 0} /></label>}
    <button className="primary-button">{t.create}</button>
  </form>;
}

function ModulePage({ view, title, api, t, language, user, options }: { view: AppView; title: string; api: <T>(path: string, init?: RequestInit) => Promise<T>; t: Labels; language: Language; user: User; options: SelectOption[] }) {
  const [data, setData] = useState<Row[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendarReminders, setCalendarReminders] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showAnnualForm, setShowAnnualForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState('');
  const [leaveService, setLeaveService] = useState('');
  const [assignees, setAssignees] = useState<{ id: number; full_name: string }[]>([]);
  const [referenceRules, setReferenceRules] = useState<ReferenceRules>(defaultReferenceRules);
  const config = moduleTables[view];

  async function load() {
    if (!config) return;
    setError('');
    try {
      let suffix = '';
      if (view === 'calendar') {
        const start = calendarMonth;
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        suffix = `?from=${localDateValue(start)}&to=${localDateValue(end)}`;
      } else if (view === 'annual' || view === 'workPlan') {
        suffix = `?year=${year}${view === 'annual' && query ? `&q=${encodeURIComponent(query)}` : ''}`;
      } else if (view === 'leaves' && query) suffix = `?q=${encodeURIComponent(query)}`;
      const result = await api<{ data: Row[] }>(`${config.endpoint}${suffix}`);
      setData(result.data);
      if (view === 'leaves') {
        const result = await api<{ balance: number | null; service: string }>('/leaves/balance');
        setBalanceDraft(result.balance == null ? '' : String(result.balance));
        setLeaveService(result.service);
      }
      if (view === 'calendar') {
        const reminders = await api<{ data: Row[] }>('/reminders');
        setCalendarReminders(reminders.data.filter((reminder) => !reminder.is_sent));
      }
      if (view === 'reminders' && ['admin', 'manager'].includes(user.role)) {
        const users = await api<{ data: { id: number; full_name: string }[] }>('/reminders/assignees');
        setAssignees(users.data);
      }
    } catch (cause) { setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); }
  }

  useEffect(() => { void load(); }, [view, year, query, calendarMonth, api, language, t.failure, user.role]);
  useEffect(() => {
    if (view !== 'annual') return;
    void api<{ data: ReferenceRules }>('/reference-rules')
      .then((result) => setReferenceRules(result.data))
      .catch((cause) => setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure));
  }, [view, api, language, t.failure]);
  useEffect(() => {
    if (view !== 'reminders') return;
    let active = true;
    const refreshReminders = () => {
      void api<{ data: Row[] }>('/reminders').then((result) => {
        if (active) setData(result.data);
      }).catch(() => undefined);
    };
    const interval = setInterval(refreshReminders, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [view, api]);

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      const assignToUserIds = form.getAll('assignToUserIds').map(Number).filter((id) => id > 0);
      const visibleUntil = String(form.get('visibleUntil') ?? '');
      await api('/reminders', { method: 'POST', body: JSON.stringify({ title: form.get('title'), details: form.get('details'), reminderAt: new Date(String(form.get('reminderAt'))).toISOString(), importance: form.get('importance'), leadMinutes: 0, ...(assignToUserIds.length ? { assignToUserIds } : {}), ...(visibleUntil ? { visibleUntil } : {}) }) });
      setShowReminderForm(false);
      await load();
    } catch (cause) { setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); }
  }

  async function createAnnualProgram(payload: Record<string, string | number | null>) {
    try {
      await api('/planning/annual', { method: 'POST', body: JSON.stringify(payload) });
      setShowAnnualForm(false);
      await load();
    } catch (cause) {
      setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure);
    }
  }

  async function createLeave(payload: Record<string, unknown>) {
    await api('/leaves', { method: 'POST', body: JSON.stringify(payload) });
    setShowLeaveForm(false);
    await load();
  }
  async function saveLeaveBalance() {
    try { await api('/leaves/balance', { method: 'PUT', body: JSON.stringify({ balance: Number(balanceDraft) }) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
  }
  async function deleteLeave(id: Row['id']) {
    if (!window.confirm(t.confirmDeleteLeave)) return;
    try { await api(`/leaves/${id}`, { method: 'DELETE' }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t.failure); }
  }
  function exportLeaveCsv() {
    const csv = [moduleTables.leaves!.columns.map(([, label]) => t[label]).join(';'), ...data.map((row) => moduleTables.leaves!.columns.map(([key]) => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(';'))].join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = 'conges.csv'; link.click(); URL.revokeObjectURL(link.href);
  }

  const calendarContent = view === 'calendar' ? <CalendarView month={calendarMonth} setMonth={setCalendarMonth} events={data} reminders={calendarReminders.filter((reminder) => !reminder.is_sent)} error={error} t={t} language={language} /> : null;
  if (calendarContent) return calendarContent;

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t.moduleEyebrow}</span><h1>{title}</h1><p>{view === 'calendar' ? calendarMonth.toLocaleDateString(language === 'ar' ? 'ar-TN' : 'fr-FR', { month: 'long', year: 'numeric' }) : `${data.length} ${t.element}`}</p></div>
      {view === 'calendar' && <div className="calendar-month-control"><button className="icon-button" aria-label={t.previousMonth} onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ArrowLeft size={17} /></button><button className="icon-button" aria-label={t.nextMonth} onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div>}
      {view === 'reminders' && <button className="primary-button" onClick={() => setShowReminderForm(!showReminderForm)}><Bell size={16} /> {t.addReminder}</button>}
      {view === 'annual' && ['admin', 'manager'].includes(user.role) && <button className="primary-button" onClick={() => setShowAnnualForm((shown) => !shown)}><Plus size={16} /> {t.createAnnualEntry}</button>}
      {view === 'leaves' && <button className="primary-button" onClick={() => setShowLeaveForm(true)}><Plus size={16} /> {t.newLeave}</button>}
    </div>
    {(view === 'annual' || view === 'workPlan') && <div className="list-toolbar"><label className="year-filter">{t.year}<input type="number" min="2000" max="2200" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>{view === 'annual' && <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} /></label>}</div>}
    {view === 'leaves' && <div className="list-toolbar"><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} /></label><button className="secondary-button" onClick={exportLeaveCsv}>{t.leaveExportCsv}</button><button className="secondary-button" onClick={() => window.print()}><Printer size={16} /> {t.leaveExportPdf}</button><label className="leave-balance-control"><strong>{t.leaveEmployeeBalance}</strong><input type="number" min="0" step="0.5" value={balanceDraft} onChange={(event) => setBalanceDraft(event.target.value)} placeholder={t.leaveBalanceNotSet} /><button className="secondary-button small" onClick={() => void saveLeaveBalance()}>{t.saveBalance}</button></label></div>}
    {showLeaveForm && <LeaveRequestForm t={t} service={leaveService} onCancel={() => setShowLeaveForm(false)} onSave={createLeave} />}
    {showAnnualForm && <AnnualProgramForm rules={referenceRules} options={options} language={language} t={t} year={year} onCancel={() => setShowAnnualForm(false)} onSave={createAnnualProgram} />}
    {view === 'reminders' && <div className="list-toolbar"><PushNotificationsControl api={api} t={t} /></div>}
    {showReminderForm && <ReminderForm options={options} assignees={assignees} userRole={user.role} t={t} language={language} onSubmit={createReminder} />}
    {error && <p className="error-message" role="alert">{error}</p>}
    {config ? <div className={view === 'calendar' ? 'calendar-layout' : ''}><div className="table-wrap"><table><thead><tr>{config.columns.map(([key, label]) => <th key={label} className={view === 'changeLog' && key === 'new_values' ? 'audit-new-value' : undefined}>{t[label]}</th>)}{view === 'leaves' && <th>{t.actions}</th>}</tr></thead><tbody>{data.length ? data.map((row, index) => <tr key={String(row.id ?? index)}>{config.columns.map(([key]) => <td key={key} className={view === 'changeLog' && key === 'new_values' ? 'audit-new-value' : undefined}>{view === 'calendar' && key === 'title' ? <a href={String(row.link ?? '#')}>{String(row[key] ?? '—')}</a> : view === 'reminders' && key === 'title' && row.dossier_id ? <a href={`#/dossiers/${row.dossier_id}/edit`}>{String(row[key] ?? '—')}</a> : view === 'changeLog' && (key === 'old_values' || key === 'new_values')     ? <code style={key === 'new_values' ? { display: 'block', minWidth: '240px', maxWidth: '420px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } : undefined}>{formatAuditValue(row[key])}</code> : key === 'changed_at' && row[key] ? formatDateTime(String(row[key])) : key === 'status' || key === 'state' ? statusLabel(String(row[key] ?? ''), t, options) : key === 'kind' ? row[key] === 'opening' ? t.eventOpening : row[key] === 'contract_end' ? t.eventContractEnd : String(row[key] ?? '—') : key === 'importance' ? options.find((option) => option.list_key === 'reminder_importance' && option.option_value === row[key])?.[language === 'ar' ? 'label_ar' : 'label_fr'] ?? String(row[key] ?? '—') : formatDateValue(row[key]) ?? String(row[key] ?? '—')}</td>)}{view === 'leaves' && <td className="row-actions"><button className="table-action" title={t.printLeave} onClick={() => printLeaveRequest(row, language)}><Printer size={15} /></button><button className="table-action danger" title={t.delete} onClick={() => void deleteLeave(row.id)}><Trash2 size={15} /></button></td>}</tr>) : <tr><td colSpan={config.columns.length + (view === 'leaves' ? 1 : 0)} className="empty-state">{t.noRows}</td></tr>}</tbody></table></div>{view === 'calendar' && <aside className="calendar-notifications"><h2>{t.notifications}</h2>{calendarReminders.length ? calendarReminders.map((reminder) => <article key={String(reminder.id)}><Bell size={15} /><div><strong>{String(reminder.title)}</strong><p>{String(reminder.details ?? '')}</p><time>{formatDateTime(String(reminder.reminder_at))}</time></div></article>) : <p className="empty-state">{t.noNotifications}</p>}</aside>}</div> : <p className="empty-state">{t.noSource}</p>}
    {view === 'calendar' && <div className="module-footnote">{t.calendarNote}</div>}
  </>;
}

const trackingFields: [string, keyof Labels][] = [
  ['date_first_legal_document', 'trackingFirstDocument'], ['date_send_admin_signature', 'trackingSendAdmin'],
  ['date_admin_signed_return', 'trackingReturnAdmin'], ['date_send_client_signature', 'trackingSendClient'],
  ['date_client_signed_return', 'trackingReturnClient'], ['date_send_registration', 'trackingRegistration'],
  ['date_registered_return', 'trackingRegistered'], ['date_effective', 'trackingEffective'], ['date_end', 'dateContractEnd'], ['date_archived', 'trackingArchive'],
];
function ContractDialog({ row, api, t, language, onClose }: { row: Row; api: <T>(path: string, init?: RequestInit) => Promise<T>; t: Labels; language: 'fr' | 'ar'; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(trackingFields.map(([key]) => [key, form.get(key) || null]));
    try { await api(`/contracts/${row.id}/tracking`, { method: 'PATCH', body: JSON.stringify(values) }); onClose(); }
    catch (cause) { setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><form className="tracking-modal" lang={language} onSubmit={save}><header><div><span className="eyebrow">{row.contract_number}</span><h2>{t.tracking}</h2><p>{row.subject}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label={t.close}>×</button></header><div className="date-grid">{trackingFields.map(([key, label]) => <label key={key}>{t[label]}<DateInput name={key} /></label>)}</div>{error && <p className="error-message" role="alert">{language === 'ar' ? t.failure : error}</p>}<footer><button type="button" className="secondary-button" onClick={onClose}>{t.close}</button><button className="primary-button" disabled={saving}>{saving ? t.saving : t.save}</button></footer></form></div>;
}

function ContractEditor({ row, isNew, api, t, language, options, onClose, onSaved }: {
  row: Row; isNew: boolean; api: <T>(path: string, init?: RequestInit) => Promise<T>; t: Labels; language: 'fr' | 'ar'; options: SelectOption[]; onClose: () => void; onSaved: () => void;
}) {
  const [dossiers, setDossiers] = useState<Row[]>([]);
  const [existingContractNumbers, setExistingContractNumbers] = useState<string[]>([]);
  const [contractNumbersReady, setContractNumbersReady] = useState(false);
  const [selectedDossierId, setSelectedDossierId] = useState(row.dossier_id == null ? '' : String(row.dossier_id));
  const [contractNumber, setContractNumber] = useState(String(row.contract_number ?? ''));
  const [contractSubject, setContractSubject] = useState(String(row.subject ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dossierError, setDossierError] = useState('');
  const [contractNumberError, setContractNumberError] = useState('');
  const [referenceRules, setReferenceRules] = useState<ReferenceRules>(defaultReferenceRules);
  const apiRef = useRef(api);
  const contractSubjectEdited = useRef(false);
  apiRef.current = api;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const first = await apiRef.current<ListResult>('/dossiers?page=1&pageSize=100');
        const allDossiers = [...first.data];
        for (let page = 2; page <= first.pagination.pages; page += 1) {
          const result = await apiRef.current<ListResult>(`/dossiers?page=${page}&pageSize=100`);
          allDossiers.push(...result.data);
        }
        if (!cancelled) {
          setDossiers(allDossiers);
          const linkedDossier = allDossiers.find((dossier) => String(dossier.id) === selectedDossierId);
          if (linkedDossier && !contractSubjectEdited.current) setContractSubject(String(linkedDossier.subject ?? ''));
        }
      } catch {
        if (!cancelled) setDossiers([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!isNew) return;
    let cancelled = false;
    void (async () => {
      try {
        const first = await apiRef.current<ListResult>('/contracts?page=1&pageSize=100');
        const allNumbers = first.data.map((contract) => String(contract.contract_number ?? '')).filter(Boolean);
        for (let page = 2; page <= first.pagination.pages; page += 1) {
          const result = await apiRef.current<ListResult>(`/contracts?page=${page}&pageSize=100`);
          allNumbers.push(...result.data.map((contract) => String(contract.contract_number ?? '')).filter(Boolean));
        }
        if (!cancelled) setExistingContractNumbers(allNumbers);
      } catch {
        if (!cancelled) setExistingContractNumbers([]);
      } finally {
        if (!cancelled) setContractNumbersReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isNew]);
  useEffect(() => {
    void apiRef.current<{ data: ReferenceRules }>('/reference-rules').then((result) => setReferenceRules(result.data))
      .catch((cause) => setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure));
  }, [language, t.failure]);

  const suggestedNumber = isNew && contractNumbersReady
    ? suggestContractNumber(existingContractNumbers, referenceRules)
    : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const number = String(form.get('contract_number') ?? '').trim();
    let hasValidationError = false;
    if (!form.get('dossier_id')) {
      setDossierError(t.contractDossierRequired);
      (event.currentTarget.elements.namedItem('dossier_id') as HTMLSelectElement | null)?.focus();
      hasValidationError = true;
    } else setDossierError('');
    if (!number) {
      setContractNumberError(t.contractNumberRequired);
      hasValidationError = true;
    } else if (!isReferenceMaskValid(number, referenceRules.masks.contract)) {
      setContractNumberError(t.contractNumberMaskError.replace('{mask}', referenceRules.masks.contract));
      (event.currentTarget.elements.namedItem('contract_number') as HTMLInputElement | null)?.focus();
      hasValidationError = true;
    } else setContractNumberError('');
    if (hasValidationError) return;
    setBusy(true);
    const payload = {
      dossier_id: form.get('dossier_id') ? Number(form.get('dossier_id')) : null,
      contract_number: number,
      subject: contractSubject.trim(),
      holder: String(form.get('holder') ?? '').trim() || null,
      amount: form.get('amount') ? Number(form.get('amount')) : null,
      currency: String(form.get('currency') ?? 'TND').trim().toUpperCase(),
      state: String(form.get('state') ?? 'pending'),
      ...Object.fromEntries(trackingFields.map(([key]) => [key, form.get(key) || null])),
    };
    try {
      await api(isNew ? '/contracts' : `/contracts/${row.id}`, { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify(payload) });
      onSaved();
    } catch (cause) {
      setError(language === 'ar' ? t.failure : cause instanceof Error ? cause.message : t.failure);
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="tracking-modal contract-edit-form" lang={language} onSubmit={save}>
    <header><div><span className="eyebrow">{t.contracts}</span><h2>{isNew ? t.addContract : t.editContract}</h2><p>{String(row.contract_number ?? '')}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label={t.close}><X size={18} /></button></header>
    <div className="contract-fields">
      <label className="contract-field-wide">{t.linkedDossier}<select name="dossier_id" aria-invalid={Boolean(dossierError)} aria-describedby={dossierError ? 'contract-dossier-error' : undefined} value={selectedDossierId} onChange={(event) => { const nextDossierId = event.target.value; setSelectedDossierId(nextDossierId); setDossierError(''); setError(''); const dossier = dossiers.find((item) => String(item.id) === nextDossierId); if (dossier) { contractSubjectEdited.current = false; setContractSubject(String(dossier.subject ?? '')); } }}><option value="">{t.noLinkedDossier}</option>{selectedDossierId && !dossiers.some((dossier) => String(dossier.id) === selectedDossierId) && <option value={selectedDossierId}>{String(row.dossier_reference ?? `${t.dossierId} ${selectedDossierId}`)}</option>}{dossiers.map((dossier) => <option key={String(dossier.id)} value={String(dossier.id)}>{String(dossier.reference ?? '')} · {String(dossier.subject ?? '')}</option>)}</select>{dossierError && <small id="contract-dossier-error" className="error-message" role="alert">{dossierError}</small>}</label>
      <label>{t.contractNumber}<input name="contract_number" aria-invalid={Boolean(contractNumberError)} aria-describedby={contractNumberError ? 'contract-number-error' : undefined} value={contractNumber} onChange={(event) => { setContractNumber(formatReference(event.currentTarget.value, referenceRules.masks.contract, 'AP')); setContractNumberError(''); }} maxLength={80} />{contractNumberError && <small id="contract-number-error" className="error-message" role="alert">{contractNumberError}</small>}{suggestedNumber && <span className="reference-suggestion"><small>{t.suggestedReference}: {suggestedNumber}</small><button type="button" className="secondary-button small" onClick={() => { setContractNumber(suggestedNumber); setContractNumberError(''); }}>{t.useReferenceSuggestion}</button></span>}</label>
      <label>{t.detailStatus}<select name="state" defaultValue={String(row.state ?? 'pending')}>{!options.some((option) => option.list_key === 'contract_state' && option.option_value === row.state && option.is_active !== false) && <option value={String(row.state ?? 'pending')}>{String(row.state ?? 'pending')}</option>}{options.filter((option) => option.list_key === 'contract_state' && option.is_active !== false).map((option) => <option key={option.id} value={option.option_value}>{language === 'ar' ? option.label_ar : option.label_fr}</option>)}</select></label>
      <label className="contract-field-wide">{t.detailSubject}<textarea name="subject" value={contractSubject} onChange={(event) => { contractSubjectEdited.current = true; setContractSubject(event.target.value); }} required maxLength={500} rows={2} /></label>
      <label>{t.holder}<input name="holder" defaultValue={String(row.holder ?? '')} maxLength={200} /></label>
      <label>{t.amount}<input name="amount" type="number" min="0" step="0.001" defaultValue={row.amount === null ? '' : String(row.amount ?? '')} /></label>
      <label>{t.currency}<input name="currency" defaultValue={String(row.currency ?? 'TND').trim()} required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" /></label>
    </div>
    <h3 className="contract-date-heading">{t.contractDates}</h3>
    <div className="date-grid">{trackingFields.map(([key, label]) => <label key={key}>{t[label]}<DateInput name={key} defaultValue={String(row[key] ?? '').slice(0, 10)} /></label>)}</div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <footer><button type="button" className="secondary-button" onClick={onClose}>{t.cancel}</button><button className="primary-button" disabled={busy}>{busy ? t.saving : t.saveContract}</button></footer>
  </form></div>;
}

export default App;
