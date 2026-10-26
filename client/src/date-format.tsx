import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';

function validDateParts(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatInputValue(value: string, dateTime: boolean) {
  const hasTimezone = dateTime && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const source = hasTimezone ? new Date(value) : null;
  if (source && Number.isNaN(source.getTime())) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return '';
  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute] = match;
  const year = source ? String(source.getFullYear()) : rawYear;
  const month = source ? String(source.getMonth() + 1).padStart(2, '0') : rawMonth;
  const day = source ? String(source.getDate()).padStart(2, '0') : rawDay;
  const hour = source ? String(source.getHours()).padStart(2, '0') : rawHour;
  const minute = source ? String(source.getMinutes()).padStart(2, '0') : rawMinute;
  const date = `${day}/${month}/${year}`;
  return dateTime && hour && minute ? `${date} ${hour}:${minute}` : date;
}

function parseInputValue(value: string, dateTime: boolean) {
  const match = value.trim().match(dateTime
    ? /^(\d{2})\/(\d{2})\/(\d{4})[ ](\d{2}):(\d{2})$/
    : /^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dayText, monthText, yearText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!validDateParts(year, month, day)) return null;
  if (!dateTime) return `${yearText}-${monthText}-${dayText}`;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour > 23 || minute > 59) return null;
  return `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return formatInputValue(value, false) || '—';
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const input = formatInputValue(value, true);
  if (!input) return '—';
  return input.includes(' ') ? input : `${input} 00:00`;
}

export function formatDateValue(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?/.test(value)) return null;
  return value.includes(':') ? formatDateTime(value) : formatDate(value);
}

export function todayISODate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

type DateInputProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  dateTime?: boolean;
  showPicker?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
};

export function DateInput({ value, defaultValue, onChange, name, required, disabled, dateTime = false, showPicker = false, 'aria-invalid': isInvalid, ...accessibility }: DateInputProps) {
  const currentValue = value ?? defaultValue ?? '';
  const [text, setText] = useState(() => formatInputValue(currentValue, dateTime));
  const parsed = parseInputValue(text, dateTime);

  useEffect(() => {
    setText(formatInputValue(currentValue, dateTime));
  }, [currentValue, dateTime]);

  const updateFromPicker = (next: string) => {
    setText(formatInputValue(next, dateTime));
    onChange?.(next);
  };

  return <>
    <span className={showPicker && !dateTime ? 'date-input-with-picker' : undefined}>
    <input
      {...accessibility}
      type="text"
      dir="ltr"
      inputMode="text"
      placeholder={dateTime ? 'JJ/MM/AAAA HH:mm' : 'JJ/MM/AAAA'}
      value={text}
      required={required}
      disabled={disabled}
      pattern={dateTime ? '\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}' : '\\d{2}/\\d{2}/\\d{4}'}
      aria-invalid={Boolean(isInvalid) || (Boolean(text) && !parsed)}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const nextValue = next ? parseInputValue(next, dateTime) : '';
        if (nextValue !== null) onChange?.(nextValue);
      }}
    />
    {showPicker && !dateTime && <span className="date-picker-control" aria-hidden="true"><CalendarDays size={17} /><input type="date" value={parsed ?? ''} disabled={disabled} tabIndex={-1} aria-label="Sélectionner une date" onChange={(event) => updateFromPicker(event.target.value)} /></span>}
    </span>
    {name && <input type="hidden" name={name} value={parsed ?? ''} disabled={disabled} />}
  </>;
}
