import AsyncStorage from '@react-native-async-storage/async-storage';
import burnsClub from '../data/burns.json';

const STORAGE_KEY_COURSE = 'currentCourse';
const STORAGE_KEY_SAVED_COURSES = 'savedCourses';

/**
 * Get the active course (currentCourse from storage, or Burns fallback)
 * Returns a course object with shape: { name: string, holes: [...] }
 */
export async function getActiveCourse() {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_COURSE);
    if (json) {
      const parsed = JSON.parse(json);
      if (parsed && parsed.holes && Array.isArray(parsed.holes)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error loading currentCourse, falling back to Burns:', e);
  }

  // Fallback to Burns Club
  return {
    name: burnsClub.courseName,
    holes: burnsClub.holes,
  };
}

/**
 * Save a course as the active course
 */
export async function saveActiveCourse(course) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_COURSE, JSON.stringify(course));
  } catch (e) {
    console.error('Error saving currentCourse:', e);
    throw e;
  }
}

/**
 * Clear the active course (reverts to Burns)
 */
export async function clearActiveCourse() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_COURSE);
  } catch (e) {
    console.error('Error clearing currentCourse:', e);
    throw e;
  }
}

/**
 * Get all saved courses
 * Returns an array of course objects
 */
export async function getSavedCourses() {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_SAVED_COURSES);
    if (json) {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error loading saved courses:', e);
  }
  return [];
}

/**
 * Add a course to the saved courses list
 * If a course with the same id exists, it will be replaced
 */
export async function addSavedCourse(course) {
  try {
    const saved = await getSavedCourses();

    // Remove existing course with same id if present
    const filtered = saved.filter((c) => c.id !== course.id);

    // Add new course
    filtered.push(course);

    await AsyncStorage.setItem(
      STORAGE_KEY_SAVED_COURSES,
      JSON.stringify(filtered),
    );
  } catch (e) {
    console.error('Error adding saved course:', e);
    throw e;
  }
}

/**
 * Delete a saved course by id
 */
export async function deleteSavedCourse(id) {
  try {
    const saved = await getSavedCourses();
    const filtered = saved.filter((c) => c.id !== id);
    await AsyncStorage.setItem(
      STORAGE_KEY_SAVED_COURSES,
      JSON.stringify(filtered),
    );
  } catch (e) {
    console.error('Error deleting saved course:', e);
    throw e;
  }
}
