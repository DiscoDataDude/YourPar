import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { saveActiveCourse, addSavedCourse } from '../utils/courseUtils';
import {
  getDistanceUnits,
  getUnitLabel,
  convertDistance,
  yardsToMeters,
} from '../utils/distanceUnits';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';

// Default values for a typical course
const DEFAULT_PARS = {
  9: [4, 4, 3, 4, 5, 4, 3, 5, 4], // Par 36
  18: [4, 4, 3, 4, 3, 4, 4, 5, 5, 4, 4, 4, 4, 3, 4, 4, 5, 3], // Par 72
};

const DEFAULT_LENGTHS = {
  9: [350, 320, 160, 380, 180, 370, 150, 480, 400],
  18: [
    350, 320, 160, 380, 180, 370, 150, 480, 450, 310, 380, 310, 400, 120, 340,
    385, 480, 135,
  ],
};

export default function CourseEntryScreen() {
  const [numHoles, setNumHoles] = useState(18);
  const [courseName, setCourseName] = useState('My Course');
  const [holes, setHoles] = useState(
    Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      par: DEFAULT_PARS[18][i],
      length: DEFAULT_LENGTHS[18][i],
      index: 0,
    })),
  );
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState('meters');

  React.useEffect(() => {
    async function loadUnits() {
      const currentUnits = await getDistanceUnits();
      setUnits(currentUnits);
    }
    loadUnits();
  }, []);

  const changeNumHoles = (newNum) => {
    setNumHoles(newNum);
    setHoles(
      Array.from({ length: newNum }, (_, i) => ({
        hole: i + 1,
        par: DEFAULT_PARS[newNum][i] || 4,
        length: DEFAULT_LENGTHS[newNum][i] || 350,
        index: 0,
      })),
    );
  };

  const updateHole = (index, field, value) => {
    const updated = [...holes];
    let processedValue = Number(value) || 0;

    // Convert yards to meters for length field if in yards mode
    if (field === 'length' && units === 'yards' && processedValue > 0) {
      processedValue = yardsToMeters(processedValue);
    }

    updated[index] = { ...updated[index], [field]: processedValue };
    setHoles(updated);
  };

  // Get display value for distance (convert meters to current units)
  const getDisplayLength = (meters) => {
    if (!meters) return '';
    return convertDistance(meters, units).toString();
  };

  const saveCourse = async () => {
    // Validate par and length
    const basicValid = holes.every((h) => h.par > 0 && h.length > 0);
    if (!basicValid) {
      alert('Please ensure all holes have valid par and length values.');
      return;
    }

    // Validate index: every hole must have a unique value from 1 to numHoles
    const indices = holes.map((h) => h.index);
    const expected = Array.from({ length: numHoles }, (_, i) => i + 1);
    const missing = expected.filter((n) => !indices.includes(n));
    const duplicates = indices.filter(
      (v, i) => v > 0 && indices.indexOf(v) !== i,
    );

    if (missing.length > 0 || duplicates.length > 0) {
      let msg =
        `Each hole needs a unique Index from 1 to ${numHoles}.\n\n` +
        'The Index tells the app which holes are hardest (1) to easiest ' +
        `(${numHoles}), so every number must appear exactly once.`;
      if (duplicates.length > 0) {
        const unique = [...new Set(duplicates)].sort((a, b) => a - b);
        msg += `\n\nDuplicated: ${unique.join(', ')}`;
      }
      if (missing.length > 0) {
        msg += `\n\nMissing: ${missing.join(', ')}`;
      }
      alert(msg);
      return;
    }

    setLoading(true);
    try {
      const course = {
        name: courseName || 'My Course',
        holes: holes,
      };
      // Add to saved courses list
      await addSavedCourse(course);
      // Set as active course
      await saveActiveCourse(course);
      router.push('/goal');
    } catch (e) {
      console.error('Error saving course:', e);
      alert('Failed to save course. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text>Saving course...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Enter Course Card</Text>
        <Text style={styles.helperText}>
          This card doesn&apos;t change the course — it changes your
          expectations. Enter the hole details, then you&apos;ll choose your
          scoring goal.
        </Text>

        {/* Course Name */}
        <Text style={styles.label}>Course Name</Text>
        <TextInput
          style={styles.input}
          value={courseName}
          onChangeText={setCourseName}
          placeholder="My Course"
        />

        {/* Number of Holes Selector */}
        <View style={styles.holeSelector}>
          <Pressable
            onPress={() => changeNumHoles(9)}
            style={[
              styles.holeSelectorButton,
              numHoles === 9 && styles.holeSelectorButtonActive,
            ]}
          >
            <Text
              style={[
                styles.holeSelectorText,
                numHoles === 9 && styles.holeSelectorTextActive,
              ]}
            >
              9 Holes
            </Text>
          </Pressable>
          <View style={{ width: 10 }} />
          <Pressable
            onPress={() => changeNumHoles(18)}
            style={[
              styles.holeSelectorButton,
              numHoles === 18 && styles.holeSelectorButtonActive,
            ]}
          >
            <Text
              style={[
                styles.holeSelectorText,
                numHoles === 18 && styles.holeSelectorTextActive,
              ]}
            >
              18 Holes
            </Text>
          </Pressable>
        </View>

        {/* Table Explanation */}
        <Text style={styles.helperText}>
          You can find all of this on the course scorecard — it&apos;s usually
          printed on the back of the card or on the club&apos;s website.
        </Text>
        <Text style={styles.helperText}>
          Par is the expected number of shots for a scratch golfer. Length is the
          distance from tee to green. Index (also called Stroke Index or SI)
          ranks each hole by difficulty — 1 is the hardest, {numHoles} is the
          easiest. This helps the app decide where you get extra shots.
        </Text>

        {/* Scorecard Table */}
        <View style={styles.tableContainer}>
          {/* Header */}
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.headerCell]}>Hole</Text>
            <Text style={[styles.cell, styles.headerCell]}>Par</Text>
            <Text style={[styles.cell, styles.headerCell]}>
              Length ({getUnitLabel(units)})
            </Text>
            <Text style={[styles.cell, styles.headerCell]}>Index</Text>
          </View>

          {/* Rows */}
          {holes.map((hole, idx) => (
            <View key={hole.hole} style={styles.tableRow}>
              <Text style={styles.cell}>{hole.hole}</Text>
              <TextInput
                style={[styles.cell, styles.cellInput]}
                value={String(hole.par)}
                onChangeText={(val) => updateHole(idx, 'par', val)}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.cell, styles.cellInput]}
                value={getDisplayLength(hole.length)}
                onChangeText={(val) => updateHole(idx, 'length', val)}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.cell, styles.cellInput]}
                value={hole.index > 0 ? String(hole.index) : ''}
                onChangeText={(val) => updateHole(idx, 'index', val)}
                keyboardType="numeric"
              />
            </View>
          ))}
        </View>

        {/* Save Button */}
        <View style={{ marginTop: 20, marginBottom: 120 }}>
          <PrimaryButton title="Save Course" onPress={saveCourse} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: Colors.light.background,
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
    marginBottom: 20,
    color: Colors.light.text,
  },
  helperText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    color: Colors.light.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
    color: Colors.light.text,
  },
  holeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  holeSelectorButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  holeSelectorButtonActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  holeSelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  holeSelectorTextActive: {
    color: '#FFFFFF',
  },
  tableContainer: {
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingVertical: 8,
  },
  headerCell: {
    fontWeight: 'bold',
    fontSize: 14,
    color: Colors.light.text,
  },
  cell: {
    flex: 1,
    fontSize: 16,
    textAlign: 'center',
    color: Colors.light.text,
  },
  cellInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    borderRadius: 4,
    paddingVertical: 4,
    marginHorizontal: 2,
    color: Colors.light.text,
  },
});
