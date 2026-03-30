import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { normaliseClubDistances } from '../utils/clubDistances';
import { typography, spacing } from '../constants/ui';
import {
  getDistanceUnits,
  convertDistance,
  getUnitLabel,
  yardsToMeters,
} from '../utils/distanceUnits';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';

const DEFAULT_CLUB_ORDER = [
  'Driver',
  '3W',
  '5W',
  '4i',
  '5i',
  '6i',
  '7i',
  '8i',
  '9i',
  'PW',
  'GW',
  'SW',
  'LW',
];

const STORAGE_DISTANCES = 'clubDistances';

// Wedge group for UI
const WEDGE_NAMES = ['LW', 'SW', 'GW', 'PW'];

// Default starter distances (metres, carry)
const DEFAULT_DISTANCES = {
  Driver: 219,
  '3W': 206,
  '5W': 178,
  '4i': 155,
  '5i': 146,
  '6i': 137,
  '7i': 128,
  '8i': 119,
  '9i': 105,
  PW: 96,
  GW: 85,
  SW: 73,
  LW: 62,
};

export default function ClubsScreen() {
  const [distances, setDistances] = useState({});
  const [favouriteClub, setFavouriteClub] = useState(null);
  const [favouriteWedge, setFavouriteWedge] = useState(null);
  const [useWedgeRegulation, setUseWedgeRegulation] = useState(true);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState('meters');

  // Load stored values and units
  const loadData = async () => {
    try {
      setLoading(true);
      const [json, currentUnits] = await Promise.all([
        AsyncStorage.getItem(STORAGE_DISTANCES),
        getDistanceUnits(),
      ]);

      setUnits(currentUnits);

      let normalised;
      let needsDefaults = false;

      if (json) {
        const stored = JSON.parse(json);
        normalised = normaliseClubDistances(stored);

        const hasDistances =
          normalised.distances && Object.keys(normalised.distances).length > 0;
        needsDefaults = !hasDistances;
      } else {
        needsDefaults = true;
      }

      if (needsDefaults) {
        const defaultPayload = {
          distances: DEFAULT_DISTANCES,
          favouriteClub: null,
          favouriteWedge: null,
          useWedgeRegulation: true,
        };

        await AsyncStorage.setItem(
          STORAGE_DISTANCES,
          JSON.stringify(defaultPayload),
        );

        setDistances(DEFAULT_DISTANCES);
        setFavouriteClub(null);
        setFavouriteWedge(null);
        setUseWedgeRegulation(true);
      } else {
        const merged = {};
        DEFAULT_CLUB_ORDER.forEach((name) => {
          const val = normalised.distances?.[name];
          merged[name] =
            typeof val === 'number' ? val : Number(val) ? Number(val) : '';
        });

        setDistances(merged);
        setFavouriteClub(normalised.favouriteClub);
        setFavouriteWedge(normalised.favouriteWedge);
        setUseWedgeRegulation(normalised.useWedgeRegulation);
      }
    } catch (err) {
      console.log('Error loading distances', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, []),
  );

  async function saveData(next = {}) {
    const nextDistances = next.distances ?? distances;

    const cleanedDistances = {};
    DEFAULT_CLUB_ORDER.forEach((name) => {
      const raw = nextDistances[name];
      const num = Number(raw);
      if (!Number.isNaN(num) && num > 0) {
        cleanedDistances[name] = num;
      }
    });

    const payload = {
      distances: cleanedDistances,
      favouriteClub:
        'favouriteClub' in next ? next.favouriteClub : (favouriteClub ?? null),
      favouriteWedge:
        'favouriteWedge' in next
          ? next.favouriteWedge
          : (favouriteWedge ?? null),
      useWedgeRegulation:
        typeof next.useWedgeRegulation === 'boolean'
          ? next.useWedgeRegulation
          : useWedgeRegulation,
    };

    await AsyncStorage.setItem(STORAGE_DISTANCES, JSON.stringify(payload));
  }

  const handleDistanceChange = (clubName, value) => {
    const numValue = Number(value);
    let metersValue = value;

    if (!isNaN(numValue) && numValue > 0 && units === 'yards') {
      metersValue = yardsToMeters(numValue);
    }

    const updated = { ...distances, [clubName]: metersValue };
    setDistances(updated);
    saveData({ distances: updated });
  };

  const getDisplayValue = (metersValue) => {
    if (!metersValue) return '';
    const meters = Number(metersValue);
    if (isNaN(meters)) return '';
    return convertDistance(meters, units).toString();
  };

  const resetToDefaults = () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all club distances to the default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const defaultPayload = {
                distances: DEFAULT_DISTANCES,
                favouriteClub,
                favouriteWedge,
                useWedgeRegulation,
              };
              await AsyncStorage.setItem(
                STORAGE_DISTANCES,
                JSON.stringify(defaultPayload),
              );
              await loadData();
            } catch (e) {
              console.error('Error resetting to defaults:', e);
              Alert.alert(
                'Error',
                'Failed to reset distances. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  const toggleFavouriteClub = (clubName) => {
    const newFav = clubName === favouriteClub ? null : clubName;
    setFavouriteClub(newFav);
    saveData({ favouriteClub: newFav });
  };

  const toggleFavouriteWedge = (clubName) => {
    const newFav = clubName === favouriteWedge ? null : clubName;
    setFavouriteWedge(newFav);
    saveData({ favouriteWedge: newFav });
  };

  const wedgeClubs = DEFAULT_CLUB_ORDER.filter((c) => WEDGE_NAMES.includes(c));
  const otherClubs = DEFAULT_CLUB_ORDER.filter((c) => !WEDGE_NAMES.includes(c));

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading clubs…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Your Club Distances</Text>
      <Text style={styles.hint}>
        These are starter distances for average mid-to-high handicappers. Adjust
        them to match your real carry distance (not roll).
      </Text>

      {/* WIR Toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>
          Play for Wedge in Regulation (MyWIR)
        </Text>
        <Switch
          value={useWedgeRegulation}
          onValueChange={(v) => {
            setUseWedgeRegulation(v);
            saveData({ useWedgeRegulation: v });
          }}
        />
      </View>
      <Text style={styles.helperText}>
        When on, the app will try to leave you a comfortable full wedge instead
        of forcing awkward partial shots.
      </Text>

      {/* Wedges Section */}
      <Text style={styles.sectionHeader}>Wedges</Text>
      <Text style={styles.helperText}>
        Mark your go-to wedge — the one you&apos;re most confident hitting a
        full shot with. The app uses this when planning your approach into the
        green.
      </Text>

      <View style={styles.columnHeader}>
        <Text style={[styles.columnLabel, { flex: 1 }]}>Club</Text>
        <Text style={[styles.columnLabel, { width: 80, textAlign: 'center' }]}>
          Distance ({getUnitLabel(units)})
        </Text>
        <Text style={[styles.columnLabel, { width: 100, textAlign: 'center' }]}>
          Go-to wedge
        </Text>
      </View>

      {wedgeClubs.map((clubName) => {
        const isSelected = favouriteWedge === clubName;
        return (
          <View
            key={clubName}
            style={[styles.clubRow, isSelected && styles.clubRowSelected]}
          >
            <Text style={[styles.clubLabel, { flex: 1 }]}>{clubName}</Text>

            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="—"
              value={getDisplayValue(distances[clubName])}
              onChangeText={(val) => handleDistanceChange(clubName, val)}
            />

            <TouchableOpacity
              style={[
                styles.favouriteBadge,
                isSelected
                  ? styles.favouriteBadgeSelected
                  : styles.favouriteBadgeUnselected,
              ]}
              onPress={() => toggleFavouriteWedge(clubName)}
              activeOpacity={0.7}
            >
              <Text
                style={
                  isSelected
                    ? styles.favouriteBadgeTextSelected
                    : styles.favouriteBadgeTextUnselected
                }
              >
                {isSelected ? 'My wedge' : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Irons / Woods Section */}
      <Text style={[styles.sectionHeader, { marginTop: 32 }]}>
        Irons / Woods
      </Text>
      <Text style={styles.helperText}>
        Mark the club you trust most under pressure. When the strategy engine
        has a choice, it will prefer this club over others at a similar
        distance.
      </Text>

      <View style={styles.columnHeader}>
        <Text style={[styles.columnLabel, { flex: 1 }]}>Club</Text>
        <Text style={[styles.columnLabel, { width: 80, textAlign: 'center' }]}>
          Distance ({getUnitLabel(units)})
        </Text>
        <Text style={[styles.columnLabel, { width: 100, textAlign: 'center' }]}>
          Go-to club
        </Text>
      </View>

      {otherClubs.map((clubName) => {
        const isSelected = favouriteClub === clubName;
        return (
          <View
            key={clubName}
            style={[styles.clubRow, isSelected && styles.clubRowSelected]}
          >
            <Text style={[styles.clubLabel, { flex: 1 }]}>{clubName}</Text>

            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="—"
              value={getDisplayValue(distances[clubName])}
              onChangeText={(val) => handleDistanceChange(clubName, val)}
            />

            <TouchableOpacity
              style={[
                styles.favouriteBadge,
                isSelected
                  ? styles.favouriteBadgeSelected
                  : styles.favouriteBadgeUnselected,
              ]}
              onPress={() => toggleFavouriteClub(clubName)}
              activeOpacity={0.7}
            >
              <Text
                style={
                  isSelected
                    ? styles.favouriteBadgeTextSelected
                    : styles.favouriteBadgeTextUnselected
                }
              >
                {isSelected ? 'My club' : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={styles.resetSection}>
        <PrimaryButton
          title="Reset to Defaults"
          onPress={resetToDefaults}
          style={{ backgroundColor: Colors.light.danger }}
        />
      </View>

      <View style={{ height: spacing.xl }} />
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

  title: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: typography.titleXL.fontFamily,
    marginBottom: 8,
    color: Colors.light.text,
  },

  hint: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },

  helperText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },

  sectionHeader: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: typography.titleM.fontFamily,
    marginTop: 8,
    marginBottom: 8,
    color: Colors.light.text,
  },

  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },

  columnLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },

  clubRowSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primarySoft,
  },

  clubLabel: {
    fontSize: 17,
    fontWeight: '500',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
  },

  input: {
    width: 80,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
    textAlign: 'center',
    marginRight: 12,
  },

  favouriteBadge: {
    width: 88,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  favouriteBadgeSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },

  favouriteBadgeUnselected: {
    backgroundColor: 'transparent',
    borderColor: Colors.light.border,
  },

  favouriteBadgeTextSelected: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  favouriteBadgeTextUnselected: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  toggleLabel: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    flex: 1,
    marginRight: 16,
    color: Colors.light.text,
  },

  resetSection: {
    marginTop: 32,
    marginBottom: 16,
  },
});