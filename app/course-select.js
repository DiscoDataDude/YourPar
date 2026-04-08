import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { getSavedCourses, saveActiveCourse, addSavedCourse, deleteSavedCourse } from '../utils/courseUtils';
import { discoverNearby, ingest } from '../data/courseDataSource';
import burnsClub from '../data/burns.json';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';

// ─── constants ────────────────────────────────────────────────────────────────

const DEMO_COURSE = {
  id: 'demo/burns',
  source: 'demo',
  schemaVersion: 1,
  name: burnsClub.courseName,
  holes: burnsClub.holes,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Rough haversine distance in km between two {lat, lng} points. */
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const chord =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

/**
 * Build the merged display list.
 *
 * Each entry:
 *   { id, name, holeCount, distanceKm, isCached, course, summary }
 *
 * Rules:
 *   - All discovered nearby summaries appear (sorted by distance).
 *   - Cached saved courses not in the nearby list appear below (no distance).
 *   - Burns demo is never in this list (it's always rendered separately).
 *   - Dedupe by id.
 */
function buildMergedList(savedCourses, nearbySummaries, userLocation) {
  const savedById = new Map(
    savedCourses
      .filter((c) => c.id !== 'demo/burns')
      .map((c) => [c.id, c]),
  );

  const seen = new Set();
  const items = [];

  // Nearby courses (discovered from Overpass)
  for (const summary of nearbySummaries) {
    if (seen.has(summary.id)) continue;
    seen.add(summary.id);

    const cached = savedById.get(summary.id) ?? null;
    const distanceKm =
      userLocation && summary.location
        ? haversineKm(userLocation, summary.location)
        : null;

    items.push({
      id: summary.id ?? `osm-${summary.osmId}`,
      name: summary.name,
      holeCount: cached?.holes?.length ?? null,
      distanceKm,
      isCached: !!cached,
      course: cached,
      summary,
    });
  }

  // Sort nearby by distance (nulls last)
  items.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });

  // Cached courses NOT in the nearby list (e.g. courses played elsewhere)
  for (const course of savedCourses) {
    if (course.id === 'demo/burns') continue;
    if (seen.has(course.id)) continue;
    seen.add(course.id);

    items.push({
      id: course.id,
      name: course.name,
      holeCount: course.holes?.length ?? null,
      distanceKm: null,
      isCached: true,
      course,
      summary: null,
    });
  }

  return items;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function CourseCard({ item, onPress, onDelete, ingesting, deleting }) {
  const isIngesting = ingesting.has(item.id);
  const isDeleting = deleting === item.id;

  let distanceLabel = null;
  if (item.distanceKm != null) {
    distanceLabel =
      item.distanceKm < 1
        ? `${Math.round(item.distanceKm * 1000)} m away`
        : `${item.distanceKm.toFixed(1)} km away`;
  }

  const holeLabel = item.holeCount != null ? `${item.holeCount} holes` : null;

  return (
    <View style={styles.courseRow}>
      <TouchableOpacity
        style={styles.courseCard}
        onPress={() => onPress(item)}
        disabled={isIngesting || isDeleting}
      >
        <View style={styles.courseCardBody}>
          <Text style={styles.courseCardName}>{item.name}</Text>
          <Text style={styles.courseCardMeta}>
            {[holeLabel, distanceLabel].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {isIngesting ? (
          <ActivityIndicator size="small" color={Colors.light.primary} style={styles.courseCardRight} />
        ) : item.isCached ? (
          <Text style={styles.cachedBadge}>Saved</Text>
        ) : (
          <Text style={styles.downloadBadge}>Tap to load</Text>
        )}
      </TouchableOpacity>

      {item.isCached && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(item.id)}
          disabled={isDeleting || isIngesting}
        >
          {isDeleting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.deleteButtonText}>Remove</Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── main screen ──────────────────────────────────────────────────────────────

export default function CourseSelectScreen() {
  // Offline-first: cached courses shown immediately
  const [savedCourses, setSavedCourses] = useState([]);
  const [cachedLoaded, setCachedLoaded] = useState(false);

  // Discovery state
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('pending'); // 'pending'|'granted'|'denied'
  const [nearbySummaries, setNearbySummaries] = useState([]);
  const [discoveryStatus, setDiscoveryStatus] = useState('idle'); // 'idle'|'loading'|'done'|'error'
  const [discoveryError, setDiscoveryError] = useState(null);

  // Per-card ingest loading
  const [ingesting, setIngesting] = useState(new Set());
  const [ingestErrors, setIngestErrors] = useState({}); // id → error string

  // Per-card delete loading
  const [deleting, setDeleting] = useState(null); // id being deleted

  // Global action loading (selecting / using demo)
  const [selecting, setSelecting] = useState(false);

  const isMounted = useRef(true);
  const discoveryAbort = useRef(null);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      discoveryAbort.current?.();
    };
  }, []);

  // ── Load cached courses on focus ─────────────────────────────────────────────
  const loadCached = useCallback(async () => {
    try {
      const courses = await getSavedCourses();
      if (isMounted.current) setSavedCourses(courses);
    } catch (e) {
      console.error('[course-select] loadCached:', e);
    } finally {
      if (isMounted.current) setCachedLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadCached(); }, [loadCached]));

  // ── Discovery — callable manually or on focus ────────────────────────────────
  const runDiscovery = useCallback(async (forceRefresh = false) => {
    // Cancel any in-flight discovery
    discoveryAbort.current?.();
    let cancelled = false;
    discoveryAbort.current = () => { cancelled = true; };

    // Step 1: request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (cancelled) return;

    if (status !== 'granted') {
      if (isMounted.current) setLocationStatus('denied');
      return;
    }
    if (isMounted.current) setLocationStatus('granted');

    // Step 2: one-shot position at low accuracy
    let position;
    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
    } catch (e) {
      console.warn('[course-select] GPS fix failed:', e);
      if (isMounted.current) setLocationStatus('denied');
      return;
    }
    if (cancelled) return;

    const loc = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    if (isMounted.current) setUserLocation(loc);

    // Step 3: discover nearby
    if (isMounted.current) {
      setDiscoveryStatus('loading');
      setDiscoveryError(null);
    }
    try {
      const summaries = await discoverNearby(loc.lat, loc.lng, 50000, forceRefresh);
      if (cancelled) return;
      if (isMounted.current) {
        setNearbySummaries(summaries);
        setDiscoveryStatus('done');
      }
    } catch (e) {
      if (cancelled) return;
      console.error('[course-select] discovery failed:', e);
      if (isMounted.current) {
        setDiscoveryError(e.message ?? 'Discovery failed');
        setDiscoveryStatus('error');
      }
    }
  }, []);

  // Auto-run on first mount and each time the screen is focused
  useFocusEffect(useCallback(() => {
    runDiscovery(false);
  }, [runDiscovery]));

  // ── Actions ──────────────────────────────────────────────────────────────────

  const selectCourse = useCallback(async (course) => {
    setSelecting(true);
    try {
      await saveActiveCourse(course);
      router.push('/goal');
    } catch (e) {
      console.error('[course-select] selectCourse:', e);
    } finally {
      if (isMounted.current) setSelecting(false);
    }
  }, []);

  const selectDemo = useCallback(async () => {
    setSelecting(true);
    try {
      await saveActiveCourse(DEMO_COURSE);
      router.push('/goal');
    } catch (e) {
      console.error('[course-select] selectDemo:', e);
    } finally {
      if (isMounted.current) setSelecting(false);
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    setDeleting(id);
    try {
      await deleteSavedCourse(id);
      const updated = await getSavedCourses();
      if (isMounted.current) setSavedCourses(updated);
    } catch (e) {
      console.error('[course-select] delete failed:', e);
    } finally {
      if (isMounted.current) setDeleting(null);
    }
  }, []);

  const handleCardPress = useCallback(async (item) => {
    // Already have the full course — select immediately
    if (item.isCached && item.course) {
      return selectCourse(item.course);
    }

    // Need to ingest from OSM
    const { id, summary } = item;
    setIngesting((prev) => new Set([...prev, id]));
    setIngestErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });

    try {
      const course = await ingest(summary);
      await addSavedCourse(course);
      // Refresh cached list so the badge updates
      const updated = await getSavedCourses();
      if (isMounted.current) setSavedCourses(updated);
      await selectCourse(course);
    } catch (e) {
      console.error('[course-select] ingest failed:', e);
      if (isMounted.current) {
        setIngestErrors((prev) => ({ ...prev, [id]: 'Failed to load course. Please try again.' }));
      }
    } finally {
      if (isMounted.current) {
        setIngesting((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }
    }
  }, [selectCourse]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const mergedList = buildMergedList(savedCourses, nearbySummaries, userLocation);
  const isDiscovering = discoveryStatus === 'loading';

  // ── Render ───────────────────────────────────────────────────────────────────

  // Show a full-screen spinner only before cached courses have loaded
  if (!cachedLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Find a Course</Text>

      {/* Location / discovery status banner */}
      {locationStatus === 'pending' && (
        <View style={styles.banner}>
          <ActivityIndicator size="small" color={Colors.light.primary} />
          <Text style={styles.bannerText}>Checking location…</Text>
        </View>
      )}
      {locationStatus === 'denied' && (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Text style={styles.bannerText}>
            Enable location to find courses near you.
          </Text>
        </View>
      )}

      {/* Search button — always visible when location is available or status is known */}
      {locationStatus !== 'pending' && (
        <PrimaryButton
          title={isDiscovering ? 'Searching…' : 'Search courses near me'}
          onPress={() => runDiscovery(true)}
          disabled={isDiscovering}
          style={styles.searchButton}
        />
      )}

      {/* Nearby / saved courses */}
      {mergedList.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {nearbySummaries.length > 0 ? 'Courses near you' : 'My courses'}
            </Text>
          </View>

          {mergedList.map((item) => (
            <View key={item.id}>
              <CourseCard
                item={item}
                onPress={handleCardPress}
                onDelete={handleDelete}
                ingesting={ingesting}
                deleting={deleting}
              />
              {ingestErrors[item.id] ? (
                <Text style={styles.ingestError}>{ingestErrors[item.id]}</Text>
              ) : null}
            </View>
          ))}
        </>
      )}

      {discoveryStatus === 'done' && nearbySummaries.length === 0 && (
        <Text style={styles.emptyText}>No courses found within 50 km.</Text>
      )}
      {discoveryStatus === 'error' && (
        <Text style={styles.emptyText}>
          Couldn't reach the course database.{discoveryError ? ` (${discoveryError})` : ''}
        </Text>
      )}

      {/* Burns demo — always at bottom */}
      <View style={styles.demoSection}>
        <Text style={styles.sectionTitle}>Demo</Text>
        <TouchableOpacity
          style={[styles.courseCard, styles.demoCard]}
          onPress={selectDemo}
          disabled={selecting}
        >
          <View style={styles.courseCardBody}>
            <Text style={styles.courseCardName}>{DEMO_COURSE.name}</Text>
            <Text style={styles.courseCardMeta}>
              {DEMO_COURSE.holes.length} holes · Demo course
            </Text>
          </View>
          {selecting && (
            <ActivityIndicator size="small" color={Colors.light.primary} style={styles.courseCardRight} />
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 16,
    color: Colors.light.text,
  },

  // Search button
  searchButton: {
    marginBottom: 16,
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.primarySoft,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  bannerWarn: {
    backgroundColor: '#FFF3CD',
  },
  bannerText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },

  // Course card
  courseRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  courseCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    padding: 15,
  },
  deleteButton: {
    backgroundColor: Colors.light.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  courseCardBody: {
    flex: 1,
  },
  courseCardName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  courseCardMeta: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 3,
  },
  courseCardRight: {
    marginLeft: 8,
  },
  cachedBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
    backgroundColor: Colors.light.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: 8,
  },
  downloadBadge: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  ingestError: {
    fontSize: 13,
    color: Colors.light.danger,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // Demo section
  demoSection: {
    marginTop: 24,
  },
  demoCard: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },

  // Empty state
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
    marginBottom: 8,
  },
});
