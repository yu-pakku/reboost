'use client';
import { useMemo, useState } from 'react';
import type { LearningActivity } from '@/domain/statistics';
import type { ReviewEntry } from '@/domain/review';
import { reviewGroup } from '@/domain/review';
import { calendarDayLabel, calendarDays, calendarMonth, tokyoDateKey, tokyoTimeLabel } from '@/lib/tokyo-calendar';

type Event = { id: string; time: string; term: string; detail: string };
type CalendarDay = { planned: Event[]; completed: Event[] };
const activityNames = { l1_confirm: 'Level 1', l2_reverse: 'Level 2', l3_cloze: 'Level 3', final: '最終テスト' };

export function calendarEvents(entries: ReviewEntry[], activity: LearningActivity[], now: number) {
  const names = new Map(entries.map(entry => [entry.knowledge.id, entry.knowledge.term]));
  const result = new Map<string, CalendarDay>();
  function add(event: Event, type: keyof CalendarDay) {
    const key = tokyoDateKey(event.time);
    const day = result.get(key) ?? { planned: [], completed: [] };
    day[type].push(event);
    result.set(key, day);
  }
  for (const entry of entries) {
    const group = reviewGroup(entry, now);
    if (!group) continue;
    add({
      id: entry.knowledge.id, time: entry.progress.next_due_at!, term: entry.knowledge.term,
      detail: group === 'final' ? '最終テスト' : `Level ${entry.progress.level}`,
    }, 'planned');
  }
  for (const item of activity) {
    const term = names.get(item.knowledgeId);
    if (term === undefined) continue;
    const resultLabel = item.kind === 'final' ? (item.correct ? '合格' : '不合格')
      : item.correct === null ? '確認' : item.correct ? '正解' : '不正解';
    add({ id: item.id, time: item.time, term, detail: `${activityNames[item.kind]}・${resultLabel}` }, 'completed');
  }
  for (const day of result.values()) day.planned.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  return result;
}

export function ReviewCalendar({ entries, activity, error, now }: {
  entries: ReviewEntry[]; activity?: LearningActivity[]; error?: string; now: number;
}) {
  const today = tokyoDateKey(now);
  const [chosen, setChosen] = useState<string>();
  const [list, setList] = useState(false);
  const selected = chosen ?? today;
  const month = calendarMonth(selected);
  const { days, firstWeekday } = calendarDays(month);
  const events = useMemo(() => calendarEvents(entries, activity ?? [], now), [entries, activity, now]);
  const [year, monthNumber] = month.split('-').map(Number);
  function moveMonth(offset: number) {
    const next = calendarMonth(month, offset);
    setChosen(calendarMonth(today) === next ? today : next);
  }

  return <section className="review-calendar" aria-labelledby="calendar-month">
    <div className="calendar-title">
      <button type="button" className="calendar-control" aria-label="前月" onClick={() => moveMonth(-1)}>‹</button>
      <h2 id="calendar-month" aria-live="polite">{year}年 {monthNumber}月</h2>
      <div className="calendar-month-actions">
        <button type="button" className="calendar-control" onClick={() => setChosen(undefined)}>今日</button>
        <button type="button" className="calendar-control" aria-label="翌月" onClick={() => moveMonth(1)}>›</button>
      </div>
    </div>
    <div className="calendar-toolbar">
      <p className="calendar-legend"><span><i className="calendar-mark" aria-hidden="true"/>実績</span><span><i className="calendar-mark planned" aria-hidden="true"/>予定</span></p>
      <div className="segmented-control" role="group" aria-label="カレンダーの表示">
        <button type="button" aria-pressed={!list} onClick={() => setList(false)}>月表示</button>
        <button type="button" aria-pressed={list} onClick={() => setList(true)}>日別リスト</button>
      </div>
    </div>
    <div className={list ? 'calendar-date-list' : 'calendar-grid'}>
      {!list && <>
        {[...'日月火水木金土'].map(day => <span key={day} className="calendar-weekday" aria-hidden="true">{day}</span>)}
        {Array.from({ length: firstWeekday }, (_, i) => <span key={i} aria-hidden="true"/>)}
      </>}
      {days.filter(day => !list || events.has(day) || day === today || day === selected).map(day => {
        const planned = events.get(day)?.planned.length ?? 0;
        const completed = events.get(day)?.completed.length ?? 0;
        return <button type="button" key={day} className="calendar-date" aria-pressed={day === selected}
          aria-current={day === today ? 'date' : undefined}
          aria-label={`${year}年${calendarDayLabel(day)}、実績${completed}件、予定${planned}件`}
          onClick={() => setChosen(day)}>
          <span>{list ? calendarDayLabel(day) : Number(day.slice(-2))}</span>
          {list ? <small>実績 {completed} · 予定 {planned}</small> :
            <span className="calendar-marks" aria-hidden="true">{completed > 0 && <i className="calendar-mark"/>}{planned > 0 && <i className="calendar-mark planned"/>}</span>}
        </button>;
      })}
    </div>
    <section className="calendar-detail" aria-label="選択した日の詳細" aria-live="polite">
      <h3>{calendarDayLabel(selected)}{selected === today && <small> 今日</small>}</h3>
      <p className="field-note">日本時間</p>
      <CalendarEventList title="予定" events={events.get(selected)?.planned} empty="予定はありません。"/>
      <CalendarEventList title="実績" events={events.get(selected)?.completed} empty={error ?? (activity ? '学習実績はありません。' : '学習実績を読み込み中…')}/>
    </section>
  </section>;
}

function CalendarEventList({ title, events, empty }: { title: string; events?: Event[]; empty: string }) {
  return <div className="calendar-event-section"><h4>{title}</h4>
    {events?.length ? <ul>{events.map(event => <li key={event.id}>
      <time dateTime={event.time}>{tokyoTimeLabel(event.time)}</time>
      <div className="user-text"><strong>{event.term}</strong> <small>{event.detail}</small></div>
    </li>)}</ul> : <p className="field-note">{empty}</p>}
  </div>;
}
