import { db, type ReboostDatabase } from './database';

/** Only newly created databases opt in. Older empty databases also skip the introduction. */
export async function shouldShowOnboarding(database: ReboostDatabase = db) {
  return database.transaction('rw', database.settings, database.knowledge, database.progress, database.attempts, async () => {
    const preference = await database.settings.get('onboarding');
    if (preference?.id !== 'onboarding' || preference.state !== 'pending') return false;
    if (await database.knowledge.count() || await database.progress.count() || await database.attempts.count()) {
      await completeOnboarding(database);
      return false;
    }
    return true;
  });
}

export async function completeOnboarding(database: ReboostDatabase = db) {
  await database.settings.put({ id: 'onboarding', state: 'complete' });
}
