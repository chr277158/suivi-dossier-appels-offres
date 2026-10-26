import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Save, X } from 'lucide-react';
import type { Labels as I18nLabels, Language } from './i18n';
import { DateInput, formatDate as formatISODate } from './date-format';

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type User = { id: number; fullName: string; role: string };
type Labels = I18nLabels;
type OvertimeEntry = {
  id: number;
  employee_label: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  comment: string | null;
  period: string | null;
};
type Account = {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'reader';
  matricule: string | null;
  service: string | null;
  fonction: string | null;
  tel: string | null;
};
type AccountForm = {
  email: string;
  name: string;
  role: Account['role'];
  matricule: string;
  service: string;
  fonction: string;
  tel: string;
  password: string;
};

const emptyAccount: AccountForm = {
  email: '', name: '', role: 'reader', matricule: '', service: '', fonction: '', tel: '', password: '',
};

function errorMessage(error: unknown, fallback: string, language: Language) {
  if (language === 'ar') return fallback;
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string, language: Language) {
  void language;
  return formatISODate(value);
}

export function OvertimePage({ api, t, user, language }: { api: Api; t: Labels; user: User; language: Language }) {
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const result = await api<{ data: OvertimeEntry[] }>('/overtime');
      setEntries(result.data);
      setError('');
    } catch (cause) {
      setError(errorMessage(cause, t.failure, language));
    }
  }

  useEffect(() => { void load(); }, [api, language, t.failure]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api('/overtime', {
        method: 'POST',
        body: JSON.stringify({
          workDate: form.get('workDate'),
          startTime: form.get('startTime'),
          endTime: form.get('endTime'),
          period: form.get('period'),
          comment: form.get('comment'),
        }),
      });
      formElement.reset();
      setShowForm(false);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t.failure, language));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">{t.hr}</span><h1>{t.overtime}</h1><p>{entries.length} {t.entry}</p></div>
      <button className="primary-button" onClick={() => setShowForm(!showForm)}><Plus size={16} /> {t.newEntry}</button>
    </div>
    {showForm && <form className="hr-form" onSubmit={submit}>
      <label>{t.date}<DateInput name="workDate" required /></label>
      <label>{t.startTime}<input name="startTime" type="time" required /></label>
      <label>{t.endTime}<input name="endTime" type="time" required /></label>
      <label>{t.period}<input name="period" maxLength={40} placeholder={t.periodPlaceholder} /></label>
      <label className="hr-form-wide">{t.comment}<input name="comment" maxLength={500} /></label>
      <div className="hr-form-actions"><span>{t.requester} : {user.fullName}</span><button className="primary-button" disabled={busy}><Save size={15} />{busy ? t.saving : t.saveEntry}</button></div>
    </form>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="table-wrap"><table><thead><tr><th>{t.requester}</th><th>{t.date}</th><th>{t.startTime}</th><th>{t.endTime}</th><th>{t.hours}</th><th>{t.period}</th><th>{t.comment}</th></tr></thead><tbody>
      {entries.length ? entries.map((entry) => <tr key={entry.id}><td>{entry.employee_label}</td><td className="num">{formatDate(entry.work_date, language)}</td><td className="num">{entry.start_time?.slice(0, 5) ?? '—'}</td><td className="num">{entry.end_time?.slice(0, 5) ?? '—'}</td><td className="num">{Number(entry.hours).toLocaleString(language === 'ar' ? 'ar-TN' : 'fr-FR')}</td><td>{entry.period ?? '—'}</td><td>{entry.comment ?? '—'}</td></tr>) : <tr><td colSpan={7} className="empty-state">{error ? t.loadFailure : t.noRows}</td></tr>}
    </tbody></table></div>
  </>;
}

export function UserAccountsPage({ api, t, language }: { api: Api; t: Labels; language: Language }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editing, setEditing] = useState<Account | null | 'create'>(null);
  const [form, setForm] = useState<AccountForm>(emptyAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const result = await api<{ data: Account[] }>('/users');
      setAccounts(result.data);
      setError('');
    } catch (cause) {
      setError(errorMessage(cause, t.failure, language));
    }
  }

  useEffect(() => { void load(); }, [api, language, t.failure]);

  function openCreate() {
    setForm(emptyAccount);
    setEditing('create');
  }

  function openEdit(account: Account) {
    setForm({
      email: account.email,
      name: account.full_name,
      role: account.role,
      matricule: account.matricule ?? '',
      service: account.service ?? '',
      fonction: account.fonction ?? '',
      tel: account.tel ?? '',
      password: '',
    });
    setEditing(account);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    const body = {
      email: form.email,
      name: form.name,
      role: form.role,
      matricule: form.matricule,
      service: form.service || null,
      fonction: form.fonction || null,
      tel: form.tel || null,
      ...(editing === 'create' || form.password ? { password: form.password } : {}),
    };
    try {
      if (editing === 'create') await api('/users', { method: 'POST', body: JSON.stringify(body) });
      else await api(`/users/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setEditing(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, t.failure, language));
    } finally {
      setBusy(false);
    }
  }

  const roleLabels: Record<Account['role'], string> = { admin: t.administrator, manager: t.manager, reader: t.reader };

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">{t.admin}</span><h1>{t.users}</h1><p>{accounts.length} {t.accounts}</p></div>
      <button className="primary-button" onClick={openCreate}><Plus size={16} /> {t.createAccount}</button>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="table-wrap"><table><thead><tr><th>{t.actions}</th><th>{t.name}</th><th>{t.email}</th><th>{t.matricule}</th><th>{t.group}</th><th>{t.service}</th><th>{t.function}</th><th>{t.phone}</th></tr></thead><tbody>
      {accounts.length ? accounts.map((account) => <tr key={account.id}>
        <td><button className="table-action" onClick={() => openEdit(account)} aria-label={`${t.edit} ${account.full_name}`} title={`${t.edit} ${account.full_name}`}>✎</button></td>
        <td>{account.full_name}</td><td>{account.email}</td><td>{account.matricule || '—'}</td>
        <td><span className={`account-role account-role-${account.role}`}>{roleLabels[account.role]}</span></td>
        <td>{account.service || '—'}</td><td>{account.fonction || '—'}</td><td>{account.tel || '—'}</td>
      </tr>) : <tr><td colSpan={8} className="empty-state">{error ? t.loadFailure : t.noRows}</td></tr>}
    </tbody></table></div>
    {editing && <div className="hr-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
      <form className="hr-modal" onSubmit={submit}>
        <header><div><span className="eyebrow">{t.admin}</span><h2>{editing === 'create' ? t.createAccountTitle : t.editAccountTitle}</h2></div><button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label={t.closeDialog}><X size={18} /></button></header>
        <div className="hr-fields">
          <label className="hr-form-wide">{t.name}<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120} /></label>
          <label className="hr-form-wide">{t.email}<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength={200} /></label>
          <label>{t.matricule}<input value={form.matricule} onChange={(event) => setForm({ ...form, matricule: event.target.value })} required maxLength={40} /></label>
          <label>{t.group}<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Account['role'] })}><option value="admin">{t.administrator}</option><option value="manager">{t.manager}</option><option value="reader">{t.reader}</option></select></label>
          <label>{t.service}<input value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })} maxLength={160} /></label>
          <label>{t.function}<input value={form.fonction} onChange={(event) => setForm({ ...form, fonction: event.target.value })} maxLength={160} /></label>
          <label>{t.phone}<input type="tel" value={form.tel} onChange={(event) => setForm({ ...form, tel: event.target.value })} maxLength={40} /></label>
          <label className="hr-form-wide">{t.password}<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={editing === 'create'} minLength={editing === 'create' || form.password ? 6 : undefined} maxLength={72} autoComplete="new-password" />{editing !== 'create' && <small>{t.leavePasswordBlank}</small>}<small>{t.passwordPolicyHint}</small></label>
        </div>
        <footer><button type="button" className="secondary-button" onClick={() => setEditing(null)}>{t.cancel}</button><button className="primary-button" disabled={busy}><Save size={15} />{busy ? t.saving : t.saveEntry}</button></footer>
      </form>
    </div>}
  </>;
}
