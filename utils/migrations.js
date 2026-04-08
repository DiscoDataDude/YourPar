import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const SCHEMA_VERSION_KEY = 'schemaVersion';
const SAVED_COURSES_KEY = 'savedCourses';
const SAVED_COURSES_BACKUP_KEY = 'savedCourses_v0_backup';
const CURRENT_COURSE_KEY = 'currentCourse';

function migrateCourseToV1(course) {
  return {
    ...course,
    id: Crypto.randomUUID(),
    source: 'manual',
    schemaVersion: 1,
  };
}

async function migrateV0ToV1() {
  console.log('[migrations] Running v0 → v1 migration...');

  // Read savedCourses (treat absent as empty array)
  const savedJson = await AsyncStorage.getItem(SAVED_COURSES_KEY);
  const savedCourses = savedJson ? JSON.parse(savedJson) : [];

  // Back up pre-migration data
  await AsyncStorage.setItem(
    SAVED_COURSES_BACKUP_KEY,
    JSON.stringify(savedCourses),
  );
  console.log('[migrations] Backed up savedCourses to savedCourses_v0_backup');

  // Migrate each saved course
  const migratedCourses = savedCourses.map(migrateCourseToV1);
  await AsyncStorage.setItem(SAVED_COURSES_KEY, JSON.stringify(migratedCourses));

  // Migrate currentCourse if present
  const currentJson = await AsyncStorage.getItem(CURRENT_COURSE_KEY);
  if (currentJson) {
    const currentCourse = JSON.parse(currentJson);
    if (currentCourse && !currentCourse.id) {
      const migrated = migrateCourseToV1(currentCourse);
      await AsyncStorage.setItem(CURRENT_COURSE_KEY, JSON.stringify(migrated));
      console.log('[migrations] Migrated currentCourse to v1');
    }
  }

  // Write schemaVersion only after all transforms succeed
  await AsyncStorage.setItem(SCHEMA_VERSION_KEY, '1');
  console.log('[migrations] v0 → v1 migration complete');
}

/**
 * Run all pending migrations in order. Idempotent — safe to call on every launch.
 * Must be called once before any other AsyncStorage reads.
 */
export async function runMigrations() {
  try {
    const versionStr = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
    const version = versionStr ? parseInt(versionStr, 10) : 0;

    if (version >= 1) {
      console.log('[migrations] Schema already at v1, nothing to do');
      return;
    }

    await migrateV0ToV1();
  } catch (e) {
    console.error('[migrations] Migration failed — app will continue with existing data:', e);
    // Do not rethrow: a failed migration must not crash the app
  }
}
