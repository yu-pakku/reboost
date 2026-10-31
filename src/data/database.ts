import Dexie, { type Table } from 'dexie';
import { defaultSettings, type Knowledge, type LearningProgress, type ReviewAttempt, type Settings } from '@/domain/knowledge';
export class ReboostDatabase extends Dexie {
  knowledge!: Table<Knowledge, string>;
  progress!: Table<LearningProgress, string>;
  attempts!: Table<ReviewAttempt, string>;
  settings!: Table<Settings, string>;
  constructor(name = 'reboost') {
    super(name);
    this.version(1).stores({ knowledge: 'id, term, updated_at, archived_at', progress: 'knowledge_id, status, next_due_at', attempts: 'id, knowledge_id, attempted_at, final_session_id', settings: 'id' });
    this.on('populate', transaction => { transaction.table('settings').add(defaultSettings); });
  }
}
export const db = new ReboostDatabase();
