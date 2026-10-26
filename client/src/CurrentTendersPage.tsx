import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Labels, Language } from './i18n';
import { formatDateValue } from './date-format';

type Row = Record<string, string | number | boolean | null> & { id?: string | number | null };
type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type PageResult = { data: Row[]; pagination: { pages: number } };

const activeStatuses = new Set(['draft', 'published', 'evaluation']);

function statusText(status: string, t: Labels) {
  const labels: Record<string, string> = {
    draft: t.statusDraft,
    published: t.statusPublished,
    evaluation: t.statusEvaluation,
    awarded: t.statusAwarded,
  };
  return labels[status] ?? status;
}

export function CurrentTendersPage({ api, t, language }: { api: Api; t: Labels; language: Language }) {
  const apiRef = useRef(api);
  apiRef.current = api;
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const failure = t.failure;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const first = await apiRef.current<PageResult>('/dossiers?page=1&pageSize=100');
        const allRows = [...first.data];
        for (let page = 2; page <= first.pagination.pages; page += 1) {
          const result = await apiRef.current<PageResult>(`/dossiers?page=${page}&pageSize=100`);
          allRows.push(...result.data);
        }
        if (!cancelled) setRows(allRows);
      } catch {
        if (!cancelled) setError(failure);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [failure]);

  const thisYear = String(new Date().getFullYear()).slice(-2);
  const filtered = rows.filter((row) => {
    const status = String(row.status ?? '');
    const reference = String(row.reference ?? '');
    const yearInReference = reference.match(/^[^.]+\.(\d{2})\.3\.\d{4}$/)?.[1];
    if (!activeStatuses.has(status) && !(status === 'awarded' && yearInReference === thisYear)) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLocaleLowerCase(language === 'ar' ? 'ar-TN' : 'fr-FR');
    return [row.reference, row.subject, row.request_type, row.procedure_type, row.status]
      .some((value) => String(value ?? '').toLocaleLowerCase(language === 'ar' ? 'ar-TN' : 'fr-FR').includes(needle));
  });

  return <>
    <div className="page-heading"><div><span className="eyebrow">{t.registry}</span><h1>{t.currentTenders}</h1><p>{filtered.length} {t.recordCount}</p></div></div>
    <div className="list-toolbar"><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} /></label></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="table-wrap"><table><thead><tr><th>{t.tenderRef}</th><th>{t.subject}</th><th>{t.requestType}</th><th>{t.procedure}</th><th>{t.status}</th><th>{t.deadline}</th></tr></thead><tbody>
      {filtered.map((row, index) => <tr key={String(row.id ?? index)}><td><a href={`#/dossiers/${row.id}/edit`}>{String(row.reference ?? '—')}</a></td><td>{String(row.subject ?? '—')}</td><td>{String(row.request_type ?? '—')}</td><td>{String(row.procedure_type ?? '—')}</td><td>{statusText(String(row.status ?? ''), t)}</td><td>{formatDateValue(row.submission_deadline) ?? '—'}</td></tr>)}
      {!filtered.length && <tr><td colSpan={6} className="empty-state">{loading ? t.loading : t.noRows}</td></tr>}
    </tbody></table></div>
  </>;
}
