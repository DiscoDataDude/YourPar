import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_UNITS = 'distanceUnits';
const METERS_TO_YARDS = 1.09361;
const YARDS_TO_METERS = 0.9144;

/**
 * Get the current distance units setting
 * @returns {Promise<'meters'|'yards'>} The current units
 */
export async function getDistanceUnits() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_UNITS);
    return stored === 'yards' ? 'yards' : 'meters';
  } catch (e) {
    console.error('Error getting distance units:', e);
    return 'meters';
  }
}

/**
 * Convert meters to yards
 * @param {number} meters - Distance in meters
 * @returns {number} Distance in yards, rounded to nearest integer
 */
export function metersToYards(meters) {
  return Math.round(meters * METERS_TO_YARDS);
}

/**
 * Convert yards to meters
 * @param {number} yards - Distance in yards
 * @returns {number} Distance in meters, rounded to nearest integer
 */
export function yardsToMeters(yards) {
  return Math.round(yards * YARDS_TO_METERS);
}

/**
 * Convert a distance to the user's preferred units
 * @param {number} meters - Distance in meters (stored format)
 * @param {string} targetUnits - Target units ('meters' or 'yards')
 * @returns {number} Distance in target units
 */
export function convertDistance(meters, targetUnits) {
  if (targetUnits === 'yards') {
    return metersToYards(meters);
  }
  return meters;
}

/**
 * Get the unit label for display
 * @param {string} units - 'meters' or 'yards'
 * @returns {string} Short unit label ('m' or 'yd')
 */
export function getUnitLabel(units) {
  return units === 'yards' ? 'yd' : 'm';
}

/**
 * Format a distance with units
 * @param {number} meters - Distance in meters (stored format)
 * @param {string} units - 'meters' or 'yards'
 * @returns {string} Formatted distance with unit label
 */
export function formatDistance(meters, units) {
  const distance = convertDistance(meters, units);
  const label = getUnitLabel(units);
  return `${distance}${label}`;
}
