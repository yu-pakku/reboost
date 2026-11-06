import { displaySettings } from './display';

const tokyoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: displaySettings.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
});
const tokyoClock = new Intl.DateTimeFormat(displaySettings.locale, {
  timeZone: displaySettings.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export const tokyoDateKey = (time: number | string) => {
  const date = typeof time === 'number' ? new Date(time) : new Date(Date.parse(time));
  const parts = tokyoDay.formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
};
export const tokyoTimeLabel = (iso: string) => tokyoClock.format(new Date(iso));

export function calendarMonth(day: string, offset = 0) {
  const first = new Date(day.slice(0, 7) + '-01T00:00:00Z');
  first.setUTCMonth(first.getUTCMonth() + offset);
  return first.toISOString().slice(0, 10);
}

export function calendarDays(month: string) {
  const first = new Date(month + 'T00:00:00Z');
  const next = new Date(calendarMonth(month, 1) + 'T00:00:00Z');
  next.setUTCDate(0);
  const days = Array.from({ length: next.getUTCDate() }, (_, i) => month.slice(0, 8) + String(i + 1).padStart(2, '0'));
  return { firstWeekday: first.getUTCDay(), days };
}

export function calendarDayLabel(key: string) {
  const [, month, day] = key.split('-').map(Number);
  return `${month}月${day}日`;
}
