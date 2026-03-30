import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { calculateMyPar } from '../utils/strategy';
import {
  normaliseClubDistances,
  distancesToClubsArray,
} from '../utils/clubDistances';
import { buildHoleStrategy } from '../utils/holeStrategy';
import { getActiveCourse } from '../utils/courseUtils';
import { typography, spacing } from '../constants/ui';
import { getDistanceUnits, formatDistance, convertDistance, getUnitLabel } from '../utils/distanceUnits';
import { Colors } from '../constants/theme';

const STORAGE_DISTANCES = 'clubDistances';

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

export default function HoleScreen() {
  const { targetScore, holeNumber } = useLocalSearchParams();
  const target = Number(targetScore ?? 99);
  const holeNo = Number(holeNumber ?? 1);

  const [hole, setHole] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState('meters');
  const [useWedgeRegulation, setUseWedgeRegulation] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [activeCourse, currentUnits] = await Promise.all([
          getActiveCourse(),
          getDistanceUnits(),
        ]);
        const holes = calculateMyPar(activeCourse, target);
        const foundHole = holes.find((h) => h.hole === holeNo);

        if (!mounted) return;

        setHole(foundHole);
        setUnits(currentUnits);

        const json = await AsyncStorage.getItem(STORAGE_DISTANCES);
        if (!json) {
          if (mounted) setLoading(false);
          return;
        }
        const stored = JSON.parse(json);
        const normalised = normaliseClubDistances(stored);

        const distData = normalised.distances;
        const favClub = normalised.favouriteClub;
        const favWedge = normalised.favouriteWedge;
        const useWIR = normalised.useWedgeRegulation;

        const clubsArr = distancesToClubsArray(distData);

        if (!mounted) return;

        setUseWedgeRegulation(useWIR);

        if (foundHole && clubsArr.length > 0) {
          const res = buildHoleStrategy(
            foundHole.length,
            foundHole.myGIR,
            clubsArr,
            favClub,
            favWedge,
            useWIR,
            currentUnits,
          );
          setStrategy(res);
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
  }, [holeNo, target]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Building strategy…</Text>
      </View>
    );
  }

  if (!hole) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not find this hole.</Text>
      </View>
    );
  }

  const unitLabel = getUnitLabel(units);
  const girDelta = strategy ? strategy.delta : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Hole header */}
      <View style={styles.holeHeader}>
        <View>
          <Text style={styles.holeNumber}>Hole {hole.hole}</Text>
          <Text style={styles.holeMeta}>
            {formatDistance(hole.length, units)} · Par {hole.par}
          </Text>
        </View>
      </View>

      {/* Your Par stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{hole.myPar}</Text>
          <Text style={styles.statLabel}>Your Par</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{hole.myGIR}</Text>
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

      {/* Strategy section */}
      {strategy && strategy.path && strategy.path.length > 0 ? (
        <View style={styles.strategySection}>
          <Text style={styles.sectionTitle}>Your strategy</Text>

          {/* WIR callout if active */}
          {useWedgeRegulation && strategy.path.length > 1 && (
            <View style={styles.wirCallout}>
              <Text style={styles.wirCalloutText}>
                Planned to leave a full wedge into the green
              </Text>
            </View>
          )}

          {/* Shot cards */}
          {strategy.path.map((shot, i) => (
            <ShotCard key={i} shot={shot} index={i} units={units} />
          ))}

          {/* Final shot label */}
          <View style={styles.greenIndicator}>
            <View style={styles.greenDot} />
            <Text style={styles.greenLabel}>Green</Text>
          </View>

          {/* Delta callout */}
          <View style={[
            styles.deltaCard,
            girDelta > 0 && styles.deltaCardPositive,
            girDelta < 0 && styles.deltaCardNegative,
          ]}>
            <Text style={styles.deltaText}>
              {girDelta > 0
                ? `You reach the green ${girDelta} shot${girDelta > 1 ? 's' : ''} inside your plan. You have buffer — use it wisely.`
                : girDelta === 0
                  ? 'You reach the green right on plan. Stay disciplined and two-putt.'
                  : `This hole is tight. Stay patient and avoid compounding errors.`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.strategySection}>
          <Text style={styles.sectionTitle}>Your strategy</Text>
          <Text style={styles.noStrategyText}>
            Set your club distances to get a strategy for this hole.
          </Text>
        </View>
      )}

      {/* Footer tip */}
      <View style={styles.footerTip}>
        <Text style={styles.footerTipText}>
          If you find trouble, take your medicine and get back in play. One bad
          swing doesn't mean the hole is lost.
        </Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
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

  // No strategy
  noStrategyText: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 22,
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
});