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
import { typography } from '../constants/ui';
import { getDistanceUnits, formatDistance } from '../utils/distanceUnits';
import { Colors } from '../constants/theme';

const STORAGE_DISTANCES = 'clubDistances';

// -----------------------------------------------------
// HOLE SCREEN COMPONENT
// -----------------------------------------------------
export default function HoleScreen() {
  const { targetScore, holeNumber } = useLocalSearchParams();
  const target = Number(targetScore ?? 99);
  const holeNo = Number(holeNumber ?? 1);

  const [hole, setHole] = useState(null);
  const [favouriteClub, setFavouriteClub] = useState(null);
  const [favouriteWedge, setFavouriteWedge] = useState(null);
  const [useWedgeRegulation, setUseWedgeRegulation] = useState(true);
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState('meters');

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

        setFavouriteClub(favClub);
        setFavouriteWedge(favWedge);
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

  if (!hole) {
    return (
      <View style={styles.centered}>
        <Text>Could not find this hole.</Text>
      </View>
    );
  }

  if (loading || !strategy) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text>Loading hole strategy…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.holeTitle}>
        Hole {hole.hole} – {formatDistance(hole.length, units)} (Par{' '}
        {hole.myPar})
      </Text>

      <Text style={styles.detail}>My Par: {hole.myPar}</Text>
      <Text style={styles.detail}>My GIR: {hole.myGIR}</Text>

      <View style={styles.strategySection}>
        <Text style={styles.sectionTitle}>Recommended Strategy</Text>
        <Text style={styles.helperText}>
          This plan is built to maximise safe outcomes, not perfect shots.
        </Text>
        <Text style={styles.description}>{strategy.description}</Text>
      </View>

      <Text style={styles.footerHelper}>
        If you find trouble, take your medicine and get back in play. One bad
        swing doesn&apos;t mean the strategy failed.
      </Text>

      {favouriteClub && (
        <Text style={styles.footer}>Favourite club: {favouriteClub}</Text>
      )}
      {favouriteWedge && (
        <Text style={styles.footer}>Favourite wedge: {favouriteWedge}</Text>
      )}
      <Text style={styles.footer}>
        Wedge in Regulation: {useWedgeRegulation ? 'On' : 'Off'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: Colors.light.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  holeTitle: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: typography.titleL.fontFamily,
    marginBottom: 16,
    color: Colors.light.text,
  },
  detail: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: typography.titleM.fontFamily,
    marginBottom: 4,
    color: Colors.light.textSecondary,
  },
  strategySection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: typography.titleM.fontFamily,
    marginBottom: 12,
    color: Colors.light.text,
  },
  helperText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  description: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    lineHeight: 24,
    color: Colors.light.text,
  },
  footerHelper: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginTop: 24,
    marginBottom: 16,
  },
  footer: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    marginTop: 8,
  },
});
