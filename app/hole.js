import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Pressable,
  Animated,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import { calculateYourPar } from '../utils/strategy';
import {
  normaliseClubDistances,
  distancesToClubsArray,
} from '../utils/clubDistances';
import { buildHoleStrategy } from '../utils/holeStrategy';
import { recommendNextShot } from '../utils/recommendNextShot';
import { getActiveCourse } from '../utils/courseUtils';
import { typography, spacing } from '../constants/ui';
import {
  getDistanceUnits,
  formatDistance,
  convertDistance,
  getUnitLabel,
} from '../utils/distanceUnits';
import { Colors } from '../constants/theme';

const GPS_THROTTLE_MS = 1000;   // max one UI update per second
const GPS_MAX_ACCURACY_M = 20;  // discard fixes with error radius > 20 m

const STORAGE_DISTANCES = 'clubDistances';
const MIN_SCORE = 1;
const MAX_SCORE = 15;

// ─── Shot card (unchanged) ────────────────────────────────────────────────────

function ShotCard({ shot, index, units }) {
  const unitLabel = getUnitLabel(units);
  const displayDist = Math.round(convertDistance(shot.distance, units));
  const displayEffective = Math.round(convertDistance(shot.effective, units));

  return (
    <View style={styles.shotCard}>
      <View style={styles.shotNumberBadge}>
        <Text style={styles.shotNumberText}>{index + 1}</Text>
      </View>
      <View style={styles.shotDetails}>
        <Text style={styles.shotClub}>{shot.name}</Text>
        {shot.partial ? (
          <Text style={styles.shotMeta}>
            {shot.pct}% swing · ~{displayEffective}{unitLabel}
          </Text>
        ) : (
          <Text style={styles.shotMeta}>
            Full swing · {displayDist}{unitLabel}
          </Text>
        )}
      </View>
      {index === 0 && (
        <View style={styles.shotBadge}>
          <Text style={styles.shotBadgeText}>Tee</Text>
        </View>
      )}
    </View>
  );
}

// ─── Score stepper ────────────────────────────────────────────────────────────

function ScoreStepper({ yourPar, score, onScoreChange }) {
  const hasScore = score != null;

  const decrement = () => {
    const from = hasScore ? score : yourPar;
    onScoreChange(Math.max(MIN_SCORE, from - 1));
  };

  const increment = () => {
    const from = hasScore ? score : yourPar;
    onScoreChange(Math.min(MAX_SCORE, from + 1));
  };

  const isAtYourPar = hasScore && score === yourPar;
  const delta = hasScore ? score - yourPar : null;
  const deltaLabel =
    delta === null ? null : delta === 0 ? 'E' : delta > 0 ? `+${delta}` : `${delta}`;
  const deltaColor =
    delta === null
      ? Colors.light.textSecondary
      : delta < 0
        ? '#4A8C5C'
        : delta > 0
          ? Colors.light.danger
          : Colors.light.textSecondary;

  return (
    <View style={styles.scoreSection}>
      <Text style={styles.scoreSectionTitle}>Score this hole</Text>
      <View style={styles.scoreRow}>
        {/* Your Par shortcut */}
        <Pressable
          style={[styles.parShortcut, isAtYourPar && styles.parShortcutActive]}
          onPress={() => onScoreChange(yourPar)}
        >
          <Text
            style={[
              styles.parShortcutLabel,
              isAtYourPar && styles.parShortcutLabelActive,
            ]}
          >
            Your Par
          </Text>
          <Text
            style={[
              styles.parShortcutValue,
              isAtYourPar && styles.parShortcutValueActive,
            ]}
          >
            {yourPar}
          </Text>
        </Pressable>

        {/* Stepper */}
        <View style={styles.stepper}>
          <Pressable
            style={[
              styles.stepBtn,
              hasScore && score <= MIN_SCORE && styles.stepBtnDisabled,
            ]}
            onPress={decrement}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>

          <View style={styles.scoreDisplay}>
            <Text style={styles.scoreDisplayText}>
              {hasScore ? score : '—'}
            </Text>
            {deltaLabel !== null && (
              <Text style={[styles.scoreDelta, { color: deltaColor }]}>
                {deltaLabel}
              </Text>
            )}
          </View>

          <Pressable
            style={[
              styles.stepBtn,
              hasScore && score >= MAX_SCORE && styles.stepBtnDisabled,
            ]}
            onPress={increment}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Next shot panel (live GPS) ───────────────────────────────────────────────

/**
 * Shows distance to front/centre/back + a live club recommendation.
 * States: no green data (null), waiting for GPS fix, GPS active.
 */
function NextShotPanel({ hole, userLocation, clubs, prefs, fallbackShot }) {
  if (!hole.green) return null;

  if (!userLocation) {
    return (
      <View style={styles.gpsSection}>
        <Text style={styles.gpsSectionTitle}>Next shot</Text>
        <View style={styles.gpsWaiting}>
          <ActivityIndicator size="small" color={Colors.light.primary} />
          <Text style={styles.gpsWaitingText}>Waiting for GPS…</Text>
        </View>
        {fallbackShot && (
          <Text style={styles.gpsFallback}>
            From the tee: {fallbackShot.partial ? `${fallbackShot.pct}% ` : ''}{fallbackShot.name}
          </Text>
        )}
      </View>
    );
  }

  const userPt = turf.point([userLocation.lng, userLocation.lat]);
  const distToPoint = (pt) =>
    Math.round(turf.distance(userPt, turf.point([pt.lng, pt.lat]), { units: 'meters' }));

  const dCentre = distToPoint(hole.green.centre);
  const dFront  = distToPoint(hole.green.front);
  const dBack   = distToPoint(hole.green.back);

  const rec = clubs.length > 0
    ? recommendNextShot(dCentre, clubs, prefs)
    : null;

  let recLine = null;
  if (rec) {
    if (rec.type === 'putt') {
      recLine = "You're on the green — putt it out";
    } else if (rec.type === 'far') {
      recLine = 'Are you on this hole?';
    } else if (rec.type === 'layup') {
      recLine = `${rec.club} — leaves ~${rec.leave}m for a full ${rec.wedge}`;
    } else if (rec.type === 'go') {
      recLine = rec.partial
        ? `${rec.pct}% ${rec.club}`
        : `${rec.club} — full swing`;
    }
  }

  return (
    <View style={styles.gpsSection}>
      <Text style={styles.gpsSectionTitle}>Next shot</Text>

      {/* Distances row */}
      <View style={styles.gpsRow}>
        <View style={styles.gpsStat}>
          <Text style={styles.gpsValue}>{dFront}m</Text>
          <Text style={styles.gpsLabel}>Front</Text>
        </View>
        <View style={styles.gpsDivider} />
        <View style={styles.gpsStat}>
          <Text style={[styles.gpsValue, styles.gpsValueCentre]}>{dCentre}m</Text>
          <Text style={styles.gpsLabel}>Centre</Text>
        </View>
        <View style={styles.gpsDivider} />
        <View style={styles.gpsStat}>
          <Text style={styles.gpsValue}>{dBack}m</Text>
          <Text style={styles.gpsLabel}>Back</Text>
        </View>
      </View>

      {/* Recommendation */}
      {recLine && (
        <View style={styles.gpsRecRow}>
          <Text style={styles.gpsRecArrow}>→</Text>
          <Text style={styles.gpsRecText}>{recLine}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HoleScreen() {
  const { targetScore, startIndex: startIndexParam, holeRange } =
    useLocalSearchParams();
  const target = Number(targetScore ?? 99);
  const startIndex = Number(startIndexParam ?? 0);
  const range = holeRange ?? 'all';

  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();

  const [holes, setHoles] = useState([]);
  const [strategies, setStrategies] = useState({});
  const [scores, setScores] = useState({});
  const [clubsArr, setClubsArr] = useState([]);
  const [clubPrefs, setClubPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState('meters');
  const [useWedgeRegulation, setUseWedgeRegulation] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  const [userLocation, setUserLocation] = useState(null);

  const flatListRef = useRef(null);
  const swipeHintOpacity = useRef(new Animated.Value(1)).current;
  const lastGpsUpdate = useRef(0);

  // Fade-out swipe hint after 2 s
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(swipeHintOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  // Dynamic header title
  useEffect(() => {
    if (holes.length > 0 && holes[currentIndex]) {
      const h = holes[currentIndex];
      navigation.setOptions({
        title: `Hole ${currentIndex + 1} of ${holes.length} · Par ${h.par}`,
      });
    }
  }, [currentIndex, holes, navigation]);

  // Load all holes + build strategies
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [activeCourse, currentUnits] = await Promise.all([
          getActiveCourse(),
          getDistanceUnits(),
        ]);

        const filteredCourseHoles =
          range === 'front'
            ? activeCourse.holes.filter((h) => h.hole >= 1 && h.hole <= 9)
            : range === 'back'
              ? activeCourse.holes.filter((h) => h.hole >= 10 && h.hole <= 18)
              : activeCourse.holes;

        const fullCoursePar = activeCourse.holes.reduce(
          (sum, h) => sum + h.par,
          0,
        );
        const filteredPar = filteredCourseHoles.reduce(
          (sum, h) => sum + h.par,
          0,
        );
        const scaledTarget =
          range === 'all'
            ? target
            : Math.round(target * (filteredPar / fullCoursePar));

        const filteredCourse = { ...activeCourse, holes: filteredCourseHoles };
        const allHoles = calculateYourPar(filteredCourse, scaledTarget);

        if (!mounted) return;
        setHoles(allHoles);
        setUnits(currentUnits);

        const json = await AsyncStorage.getItem(STORAGE_DISTANCES);
        if (!json) {
          if (mounted) setLoading(false);
          return;
        }

        const stored = JSON.parse(json);
        const normalised = normaliseClubDistances(stored);
        const loadedClubs = distancesToClubsArray(normalised.distances);
        const { favouriteClub, favouriteWedge, useWedgeRegulation: useWIR } =
          normalised;

        if (!mounted) return;
        setUseWedgeRegulation(useWIR);
        setClubsArr(loadedClubs);
        setClubPrefs({ favouriteClub, favouriteWedge, useWedgeRegulation: useWIR });

        if (loadedClubs.length > 0) {
          const map = {};
          for (const h of allHoles) {
            map[h.hole] = buildHoleStrategy(
              h.length,
              h.yourGIR,
              loadedClubs,
              favouriteClub,
              favouriteWedge,
              useWIR,
              currentUnits,
            );
          }
          if (mounted) setStrategies(map);
        }
      } catch (e) {
        console.error('HoleScreen load error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [target, range]);

  // ── GPS subscription — only when at least one hole has green data ────────────
  useEffect(() => {
    const hasGreenData = holes.some((h) => h.green);
    if (!hasGreenData) return;

    let subscription = null;

    async function subscribe() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (position) => {
          // Discard low-accuracy fixes to avoid jumpy readings
          if (
            position.coords.accuracy != null &&
            position.coords.accuracy > GPS_MAX_ACCURACY_M
          ) return;
          const now = Date.now();
          if (now - lastGpsUpdate.current < GPS_THROTTLE_MS) return;
          lastGpsUpdate.current = now;
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
      );
    }

    subscribe();

    return () => {
      subscription?.remove();
    };
  }, [holes]);

  const handleScoreChange = useCallback((holeNum, value) => {
    setScores((prev) => ({ ...prev, [holeNum]: value }));
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const getItemLayout = useCallback(
    (_, index) => ({
      length: screenWidth,
      offset: screenWidth * index,
      index,
    }),
    [screenWidth],
  );

  const renderItem = useCallback(
    ({ item: hole }) => {
      const strategy = strategies[hole.hole];
      const score = scores[hole.hole] ?? null;
      const girDelta = strategy ? strategy.delta : 0;

      return (
        <ScrollView
          style={[styles.page, { width: screenWidth }]}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hole header */}
          <View style={styles.holeHeader}>
            <View>
              <Text style={styles.holeNumber}>Hole {hole.hole}</Text>
              <Text style={styles.holeMeta}>
                {formatDistance(hole.length, units)} · Par {hole.par}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{hole.yourPar}</Text>
              <Text style={styles.statLabel}>Your Par</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{hole.yourGIR}</Text>
              <Text style={styles.statLabel}>Shots to green</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatDistance(hole.avgShot, units)}
              </Text>
              <Text style={styles.statLabel}>Avg shot</Text>
            </View>
          </View>


          {/* Strategy — compact plan for GPS holes, full path for non-GPS */}
          {hole.green ? (
            // GPS course: show the static plan summary only (live caddie panel
            // shown outside the FlatList handles the shot-by-shot advice)
            strategy && strategy.path && strategy.path.length > 0 ? (
              <View style={styles.strategySection}>
                <Text style={styles.sectionTitle}>The plan</Text>
                <View style={styles.planSummaryCard}>
                  <Text style={styles.planSummaryText}>
                    {strategy.path.map((s) =>
                      s.partial ? `${s.pct}% ${s.name}` : s.name
                    ).join(' → ')} → green
                  </Text>
                  <Text style={styles.strategyDisclaimer}>
                    Set before the hole. The live caddie above updates as you play.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.strategySection}>
                <Text style={styles.sectionTitle}>The plan</Text>
                <Text style={styles.noStrategyText}>
                  Set your club distances to get a plan for this hole.
                </Text>
              </View>
            )
          ) : (
            // Non-GPS course: full multi-shot strategy view
            strategy && strategy.path && strategy.path.length > 0 ? (
              <View style={styles.strategySection}>
                <Text style={styles.sectionTitle}>Your strategy</Text>
                {useWedgeRegulation && strategy.path.length > 1 && (
                  <View style={styles.wirCallout}>
                    <Text style={styles.wirCalloutText}>
                      Planned to leave a full wedge into the green
                    </Text>
                  </View>
                )}
                {strategy.path.map((shot, i) => (
                  <ShotCard key={i} shot={shot} index={i} units={units} />
                ))}
                <View style={styles.greenIndicator}>
                  <View style={styles.greenDot} />
                  <Text style={styles.greenLabel}>Green</Text>
                </View>
                <View
                  style={[
                    styles.deltaCard,
                    girDelta > 0 && styles.deltaCardPositive,
                    girDelta < 0 && styles.deltaCardNegative,
                  ]}
                >
                  <Text style={styles.deltaText}>
                    {girDelta > 0
                      ? `You reach the green ${girDelta} shot${girDelta > 1 ? 's' : ''} inside your plan. You have buffer — use it wisely.`
                      : girDelta === 0
                        ? 'You reach the green right on plan. Stay disciplined and two-putt.'
                        : 'This hole is tight. Stay patient and avoid compounding errors.'}
                  </Text>
                </View>
                <Text style={styles.strategyDisclaimer}>
                  Strategy assumes flat terrain and no wind. Club up for uphill shots or into a strong headwind, and down for downhill or downwind.
                </Text>
              </View>
            ) : (
              <View style={styles.strategySection}>
                <Text style={styles.sectionTitle}>Your strategy</Text>
                <Text style={styles.noStrategyText}>
                  Set your club distances to get a strategy for this hole.
                </Text>
              </View>
            )
          )}

          {/* Score entry */}
          <ScoreStepper
            yourPar={hole.yourPar}
            score={score}
            onScoreChange={(val) => handleScoreChange(hole.hole, val)}
          />

          {/* Footer tip */}
          <View style={styles.footerTip}>
            <Text style={styles.footerTipText}>
              If you find trouble, take your medicine and get back in play. One
              bad swing doesn't mean the hole is lost.
            </Text>
          </View>
        </ScrollView>
      );
    },
    [strategies, scores, units, useWedgeRegulation, screenWidth, handleScoreChange],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Building strategy…</Text>
      </View>
    );
  }

  if (holes.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load holes.</Text>
      </View>
    );
  }

  const currentHole = holes[currentIndex] ?? null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={holes}
        keyExtractor={(item) => item.hole.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        initialScrollIndex={startIndex}
        style={{ flex: 1 }}
      />

      {/* Live next-shot panel — always for the currently visible hole */}
      {currentHole && (
        <NextShotPanel
          hole={currentHole}
          userLocation={userLocation}
          clubs={clubsArr}
          prefs={clubPrefs}
          fallbackShot={strategies[currentHole.hole]?.path?.[0] ?? null}
        />
      )}

      {/* Swipe hint — fades out after 2 s */}
      <Animated.View
        style={[styles.swipeHint, { opacity: swipeHintOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.swipeHintText}>← Swipe to change hole →</Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  page: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: spacing.l,
    paddingBottom: spacing.xl * 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    gap: spacing.s,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontFamily: typography.body.fontFamily,
  },
  errorText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontFamily: typography.body.fontFamily,
  },

  // Header
  holeHeader: {
    marginBottom: spacing.l,
  },
  holeNumber: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: typography.titleXL.fontFamily,
    color: Colors.light.text,
    marginBottom: 4,
  },
  holeMeta: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.textSecondary,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    marginBottom: spacing.l,
    paddingVertical: spacing.m,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: typography.titleXL.fontFamily,
    color: Colors.light.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },

  // Strategy section
  strategySection: {
    marginBottom: spacing.l,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: typography.titleM.fontFamily,
    color: Colors.light.text,
    marginBottom: spacing.m,
  },

  // WIR callout
  wirCallout: {
    backgroundColor: Colors.light.primarySoft,
    borderRadius: 8,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    marginBottom: spacing.m,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
  },
  wirCalloutText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.primary,
  },

  // Shot cards
  shotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: 10,
    padding: spacing.m,
    marginBottom: spacing.s,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  shotNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.m,
  },
  shotNumberText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shotDetails: {
    flex: 1,
  },
  shotClub: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
    marginBottom: 2,
  },
  shotMeta: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
  },
  shotBadge: {
    backgroundColor: Colors.light.border,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  shotBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Green indicator
  greenIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.s,
    marginBottom: spacing.m,
    marginTop: spacing.xs,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A8C5C',
    marginRight: spacing.s,
  },
  greenLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4A8C5C',
    fontFamily: typography.body.fontFamily,
  },

  // Delta card
  deltaCard: {
    borderRadius: 8,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  deltaCardPositive: {
    backgroundColor: Colors.light.primarySoft,
    borderColor: Colors.light.primary,
  },
  deltaCardNegative: {
    backgroundColor: Colors.light.card,
    borderColor: Colors.light.border,
  },
  deltaText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
    lineHeight: 20,
  },

  // Strategy disclaimer
  strategyDisclaimer: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginTop: spacing.m,
    fontStyle: 'italic',
  },

  // No strategy
  noStrategyText: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 22,
  },

  // Score section
  scoreSection: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: spacing.m,
    marginBottom: spacing.l,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  scoreSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.m,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  parShortcut: {
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    minWidth: 84,
  },
  parShortcutActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primarySoft,
  },
  parShortcutLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  parShortcutLabelActive: {
    color: Colors.light.primary,
  },
  parShortcutValue: {
    fontSize: 30,
    fontWeight: '700',
    fontFamily: typography.titleXL.fontFamily,
    color: Colors.light.text,
    marginTop: 2,
  },
  parShortcutValueActive: {
    color: Colors.light.primary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    backgroundColor: Colors.light.border,
  },
  stepBtnText: {
    fontSize: 24,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 30,
  },
  scoreDisplay: {
    alignItems: 'center',
    minWidth: 48,
  },
  scoreDisplayText: {
    fontSize: 34,
    fontWeight: '700',
    fontFamily: typography.titleXL.fontFamily,
    color: Colors.light.text,
  },
  scoreDelta: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: typography.meta.fontFamily,
    marginTop: 1,
  },

  // Swipe hint overlay
  swipeHint: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeHintText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    backgroundColor: Colors.light.card,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },

  // Footer tip
  footerTip: {
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  footerTipText: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },

  // GPS / green distance section — rendered outside FlatList, fixed at bottom
  gpsSection: {
    backgroundColor: Colors.light.card,
    borderRadius: 0,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderTopWidth: 1,
    borderColor: '#4A8C5C',
  },
  gpsSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: typography.meta.fontFamily,
    color: '#4A8C5C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: spacing.m,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsStat: {
    flex: 1,
    alignItems: 'center',
  },
  gpsValue: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: typography.titleXL.fontFamily,
    color: Colors.light.text,
    marginBottom: 2,
  },
  gpsValueCentre: {
    color: '#4A8C5C',
  },
  gpsLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  gpsDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
    height: 36,
  },
  gpsWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    paddingBottom: spacing.s,
  },
  gpsWaitingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontFamily: typography.body.fontFamily,
  },
  gpsFallback: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontFamily: typography.meta.fontFamily,
    textAlign: 'center',
    marginTop: spacing.s,
    paddingBottom: spacing.s,
  },
  gpsRecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    marginTop: spacing.m,
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  gpsRecArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A8C5C',
  },
  gpsRecText: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: typography.titleM.fontFamily,
    color: Colors.light.text,
  },

  // Static plan summary (GPS holes)
  planSummaryCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 10,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  planSummaryText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
    marginBottom: spacing.s,
  },
});
