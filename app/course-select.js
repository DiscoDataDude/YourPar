import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  getSavedCourses,
  saveActiveCourse,
  deleteSavedCourse,
} from '../utils/courseUtils';
import burnsClub from '../data/burns.json';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';

export default function CourseSelectScreen() {
  const [loading, setLoading] = useState(true);
  const [savedCourses, setSavedCourses] = useState([]);
  const [deleting, setDeleting] = useState(null);

  const loadSavedCourses = useCallback(async () => {
    try {
      const courses = await getSavedCourses();
      setSavedCourses(courses);
    } catch (e) {
      console.error('Error loading saved courses:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedCourses();
    }, [loadSavedCourses]),
  );

  const useDemoCourse = async () => {
    setLoading(true);
    try {
      // Save Burns Club as the active course
      const demoCourse = {
        name: burnsClub.courseName,
        holes: burnsClub.holes,
      };
      await saveActiveCourse(demoCourse);
      router.push('/goal');
    } catch (e) {
      console.error('Error setting demo course:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectCourse = async (course) => {
    setLoading(true);
    try {
      await saveActiveCourse(course);
      router.push('/goal');
    } catch (e) {
      console.error('Error selecting course:', e);
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async (courseName) => {
    setDeleting(courseName);
    try {
      await deleteSavedCourse(courseName);
      await loadSavedCourses();
    } catch (e) {
      console.error('Error deleting course:', e);
    } finally {
      setDeleting(null);
    }
  };

  const enterOwnCourse = () => {
    router.push('/course-entry');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Course Selection</Text>
      <Text style={styles.subtitle}>Choose which course to play</Text>
      <Text style={styles.helperText}>
        This card doesn&apos;t change the course — it changes your expectations.
      </Text>

      {/* Demo Course */}
      <View style={{ marginTop: 20, marginBottom: 10 }}>
        <PrimaryButton
          title="Use Demo Course (Burns Club)"
          onPress={useDemoCourse}
        />
      </View>

      {/* Saved Courses */}
      {savedCourses.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>My Saved Courses</Text>
          <FlatList
            data={savedCourses}
            keyExtractor={(item, idx) => `${item.name}-${idx}`}
            renderItem={({ item }) => (
              <View style={styles.courseRow}>
                <TouchableOpacity
                  style={styles.courseButton}
                  onPress={() => selectCourse(item)}
                >
                  <Text style={styles.courseText}>{item.name}</Text>
                  <Text style={styles.courseHoles}>
                    {item.holes.length} holes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteCourse(item.name)}
                  disabled={deleting === item.name}
                >
                  {deleting === item.name ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Text style={styles.deleteText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}

      {/* Enter New Course */}
      <View style={{ marginTop: 16 }}>
        <PrimaryButton title="+ Enter New Course" onPress={enterOwnCourse} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
    marginBottom: 8,
    marginTop: 20,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  helperText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: Colors.light.text,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: Colors.light.card,
    borderRadius: 8,
    overflow: 'hidden',
  },
  courseButton: {
    flex: 1,
    padding: 15,
  },
  courseText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  courseHoles: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  deleteButton: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: Colors.light.danger,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '600',
  },
});
