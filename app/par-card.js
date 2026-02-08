import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { calculateMyPar } from '../utils/strategy';
import { getActiveCourse } from '../utils/courseUtils';
import { typography } from '../constants/ui';
import { getDistanceUnits, formatDistance } from '../utils/distanceUnits';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';

function parseStrokes(value) {
  if (value === '' || value == null) return null;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1 || n > 20) return null;
  return n;
}

function formatDelta(delta) {
  if (delta === 0) return 'E';
  return delta > 0 ? `+${delta}` : String(delta);
}

export default function ParCardScreen() {
  const router = useRouter();
  const { targetScore, holeRange } = useLocalSearchParams();
  const fullTarget = Number(targetScore ?? 99);
  const range = holeRange ?? 'all';

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState('meters');
  const [strokes, setStrokes] = useState({});

  useEffect(() => {
    async function loadCourse() {
      try {
        const [activeCourse, currentUnits] = await Promise.all([
          getActiveCourse(),
          getDistanceUnits(),
        ]);
        setCourse(activeCourse);
        setUnits(currentUnits);
      } catch (e) {
        console.error('Error loading active course:', e);
      } finally {
        setLoading(false);
      }
    }
    loadCourse();
  }, []);

  if (loading || !course) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text>Loading...</Text>
      </View>
    );
  }

  // Filter holes based on selected range
  const filteredCourseHoles =
    range === 'front'
      ? course.holes.filter((h) => h.hole >= 1 && h.hole <= 9)
      : range === 'back'
        ? course.holes.filter((h) => h.hole >= 10 && h.hole <= 18)
        : course.holes;

  // Scale target proportionally for 9-hole rounds
  const fullCoursePar = course.holes.reduce((sum, h) => sum + h.par, 0);
  const filteredPar = filteredCourseHoles.reduce((sum, h) => sum + h.par, 0);
  const scaledTarget =
    range === 'all'
      ? fullTarget
      : Math.round(fullTarget * (filteredPar / fullCoursePar));

  const filteredCourse = { ...course, holes: filteredCourseHoles };
  const holes = calculateMyPar(filteredCourse, scaledTarget);

  // Calculate "My Course Par"
  const myCoursePar = holes.reduce((sum, h) => sum + h.myPar, 0);

  const rangeLabel =
    range === 'front'
      ? ' (Front 9)'
      : range === 'back'
        ? ' (Back 9)'
        : '';

  // Summary calculations
  const enteredHoles = holes.filter(
    (h) => parseStrokes(strokes[h.hole]) != null,
  );
  const holesEntered = enteredHoles.length;
  const totalDelta = enteredHoles.reduce((sum, h) => {
    const s = parseStrokes(strokes[h.hole]);
    return sum + (s - h.myPar);
  }, 0);

  const handleUpdateStrokes = (holeNum, value) => {
    setStrokes((prev) => ({ ...prev, [holeNum]: value }));
  };

  const handleEndRound = () => {
    Keyboard.dismiss();
    let message;
    if (holesEntered === 0) {
      message = 'No scores entered.';
    } else {
      const deltaText = formatDelta(totalDelta);
      const planStatus =
        totalDelta < 0
          ? 'Ahead of plan'
          : totalDelta === 0
            ? 'On plan'
            : 'Behind plan';
      message = `${holesEntered}/${holes.length} holes played.\n\nTotal vs plan: ${deltaText}\n${planStatus}.`;
    }

    Alert.alert('Round Summary', message, [
      {
        text: 'Done',
        onPress: () => {
          setStrokes({});
          router.push('/');
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Title */}
      <Text style={styles.title}>My Par Card</Text>
      <Text style={styles.courseName}>
        Course: {course.name || 'Burns Club'}
        {rangeLabel}
      </Text>
      <Text style={styles.subtitle}>My Course Par: {myCoursePar}</Text>

      <Text style={styles.helperText}>
        My Par shows how many shots you are allowed on each hole to reach your
        goal — not the course par. Tap a hole number for strategy.
      </Text>

      {/* Header */}
      <View style={styles.rowHeader}>
        <Text style={[styles.headerCell, styles.headerText, { flex: 0.5 }]}>
          Hole
        </Text>
        <Text style={[styles.headerCell, styles.headerText, { flex: 0.7 }]}>
          My Par
        </Text>
        <Text style={[styles.headerCell, styles.headerText, { flex: 0.5 }]}>
          GIR
        </Text>
        <Text style={[styles.headerCell, styles.headerText, { flex: 0.8 }]}>
          Avg Shot
        </Text>
        <Text style={[styles.headerCell, styles.headerText, { flex: 0.8 }]}>
          Strokes
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={holes}
        keyExtractor={(item) => item.hole.toString()}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => Keyboard.dismiss()}>
            <Pressable
              style={{ flex: 0.5 }}
              onPress={() => {
                Keyboard.dismiss();
                router.push({
                  pathname: '/hole',
                  params: {
                    holeNumber: item.hole,
                    targetScore: scaledTarget,
                    holeRange: range,
                  },
                });
              }}
            >
              <Text style={[styles.cell, styles.holeLink]}>{item.hole}</Text>
            </Pressable>
            <Text style={[styles.cell, { flex: 0.7 }]}>{item.myPar}</Text>
            <Text style={[styles.cell, { flex: 0.5 }]}>{item.myGIR}</Text>
            <Text style={[styles.cell, { flex: 0.8 }]}>
              {formatDistance(item.avgShot, units)}
            </Text>
            <View style={{ flex: 0.8 }}>
              <TextInput
                style={styles.strokeInput}
                keyboardType="numeric"
                value={
                  strokes[item.hole] != null ? String(strokes[item.hole]) : ''
                }
                onChangeText={(val) => handleUpdateStrokes(item.hole, val)}
                maxLength={2}
                placeholder="-"
                placeholderTextColor={Colors.light.border}
              />
            </View>
          </Pressable>
        )}
      />

      {/* Summary */}
      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            Holes entered: {holesEntered}/{holes.length}
          </Text>
          <Text style={styles.summaryText}>
            Total vs plan: {holesEntered > 0 ? formatDelta(totalDelta) : '-'}
          </Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <PrimaryButton title="End round" onPress={handleEndRound} />
        </View>
      </View>
    </KeyboardAvoidingView>
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
  courseName: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: typography.titleL.fontFamily,
    marginBottom: 8,
    color: Colors.light.primary,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: typography.titleM.fontFamily,
    marginBottom: 12,
    color: Colors.light.textSecondary,
  },
  helperText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingBottom: 8,
    marginTop: 12,
  },
  headerCell: {
    fontFamily: typography.body.fontFamily,
  },
  headerText: {
    fontWeight: '600',
    fontSize: 13,
    color: Colors.light.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.light.border,
  },
  cell: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
  },
  holeLink: {
    color: Colors.light.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  strokeInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
    textAlign: 'center',
    width: 48,
  },
  summarySection: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 12,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
  },
});
