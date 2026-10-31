import { displaySettings } from './display';
import type { LearningProgress } from '@/domain/knowledge';
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat(displaySettings.locale, { timeZone: displaySettings.timezone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export function progressLabel(progress: LearningProgress) {
  if (progress.status === 'archived') return 'アーカイブ';
  if (progress.status === 'mastered') return '定着済み（アプリ判定）';
  if (progress.status === 'final_due') return '最終テスト待ち';
  return `Level ${progress.level}・成功${progress.successes_in_level}回`;
}
