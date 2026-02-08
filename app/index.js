// app/index.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { getActiveCourse } from '../utils/courseUtils';
import { typography, spacing } from '../constants/ui';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';

export default function HomeScreen() {
  const [courseName, setCourseName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCourse() {
      try {
        const course = await getActiveCourse();
        setCourseName(course.name || 'Burns Club');
      } catch (e) {
        console.error('Error loading course:', e);
        setCourseName('Burns Club');
      } finally {
        setLoading(false);
      }
    }
    loadCourse();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>YourPar MVP</Text>

      <View style={styles.courseRow}>
        <Text style={styles.courseLabel}>Course: {courseName}</Text>
        <TouchableOpacity onPress={() => router.push('/course-select')}>
          <Text style={styles.changeButton}>Change</Text>
        </TouchableOpacity>
      </View>

      <PrimaryButton title="Start round" onPress={() => router.push('/goal')} />

      <View style={{ height: spacing.m }} />

      <PrimaryButton title="My clubs" onPress={() => router.push('/clubs')} />

      <View style={{ height: spacing.m }} />

      <PrimaryButton
        title="Settings"
        onPress={() => router.push('/settings')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.l,
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  title: {
    ...typography.titleXL,
    marginBottom: spacing.l,
    color: Colors.light.text,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.l,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    backgroundColor: Colors.light.card,
    borderRadius: spacing.s,
  },
  courseLabel: {
    ...typography.body,
    color: Colors.light.text,
  },
  changeButton: {
    ...typography.body,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});
