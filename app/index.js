// app/index.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveCourse } from '../utils/courseUtils';
import { typography, spacing } from '../constants/ui';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';

const ONBOARDING_KEY = 'hasSeenOnboarding';

const ONBOARDING_SLIDES = [
  {
    heading: 'Golf has a par problem.',
    body: "The course par wasn't designed for you. It was designed for scratch golfers — people who make up less than 2% of all players. For everyone else, it sets an unrealistic benchmark every single hole.",
  },
  {
    heading: 'Meet YourPar.',
    body: "YourPar recalculates every hole based on your goal score. That becomes your par — not the course's. You play to a target that actually makes sense for your game.",
  },
  {
    heading: 'One setup, then go.',
    body: 'Set your club distances, pick a goal score, and YourPar builds your strategy hole by hole. No swing tips. No gimmicks. Just a clear plan for every hole.',
  },
];

export default function HomeScreen() {
  const [courseName, setCourseName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    async function init() {
      try {
        const [course, seen] = await Promise.all([
          getActiveCourse(),
          AsyncStorage.getItem(ONBOARDING_KEY),
        ]);
        setCourseName(course.name || 'Burns Club');
        if (!seen) {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.error('Error loading home:', e);
        setCourseName('Burns Club');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleNext = () => {
    if (slideIndex < ONBOARDING_SLIDES.length - 1) {
      setSlideIndex(slideIndex + 1);
    }
  };

  const handleDone = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (e) {
      console.error('Error saving onboarding flag:', e);
    }
    setShowOnboarding(false);
  };

  const isLastSlide = slideIndex === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[slideIndex];

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Onboarding Modal */}
      <Modal
        visible={showOnboarding}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Slide counter dots */}
            <View style={styles.dotsRow}>
              {ONBOARDING_SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === slideIndex && styles.dotActive]}
                />
              ))}
            </View>

            <Text style={styles.modalHeading}>{slide.heading}</Text>
            <Text style={styles.modalBody}>{slide.body}</Text>

            <View style={styles.modalActions}>
              {isLastSlide ? (
                <PrimaryButton title="Let's go" onPress={handleDone} />
              ) : (
                <PrimaryButton title="Next" onPress={handleNext} />
              )}

              {!isLastSlide && (
                <Pressable onPress={handleDone} style={styles.skipButton}>
                  <Text style={styles.skipText}>Skip</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Home Screen */}
      <Text style={styles.title}>YourPar</Text>
      <Text style={styles.tagline}>Play to your par, not the course's</Text>

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
    fontSize: 36,
    marginBottom: 6,
    color: Colors.light.text,
  },

  tagline: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.textSecondary,
    marginBottom: spacing.l,
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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.l,
  },

  modalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 28,
  },

  dotsRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 6,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
  },

  dotActive: {
    backgroundColor: Colors.light.primary,
    width: 20,
  },

  modalHeading: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: typography.titleXL.fontFamily,
    color: Colors.light.text,
    marginBottom: 14,
    lineHeight: 30,
  },

  modalBody: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 24,
    marginBottom: 28,
  },

  modalActions: {
    gap: 12,
  },

  skipButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },

  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
});
