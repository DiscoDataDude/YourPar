import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';

export default function GoalScreen() {
  const [selectedGoal, setSelectedGoal] = useState(null);

  const startRound = (holeRange) => {
    router.push({
      pathname: '/par-card',
      params: { targetScore: String(selectedGoal), holeRange },
    });
  };

  // Step 2: Hole range selection
  if (selectedGoal !== null) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>How many holes?</Text>

        <Text style={styles.helper}>
          Choose how many holes you are playing. Your target will be scaled
          automatically.
        </Text>

        <PrimaryButton title="18 Holes" onPress={() => startRound('all')} />
        <View style={styles.spacer} />

        <PrimaryButton
          title="Front 9 (1–9)"
          onPress={() => startRound('front')}
        />
        <View style={styles.spacer} />

        <PrimaryButton
          title="Back 9 (10–18)"
          onPress={() => startRound('back')}
        />
        <View style={styles.spacer} />

        <Pressable onPress={() => setSelectedGoal(null)}>
          <Text style={styles.backLink}>Back to goal selection</Text>
        </Pressable>
      </View>
    );
  }

  // Step 1: Goal selection
  return (
    <View style={styles.container}>
      <Text style={styles.title}>What are you trying to break?</Text>

      <Text style={styles.helper}>
        Your goal sets how many shots you&apos;re allowed on each hole. The app
        then builds a safe strategy to help you get there.
      </Text>

      <PrimaryButton title="Break 126" onPress={() => setSelectedGoal(125)} />
      <Text style={styles.hint}>Suggested if you&apos;re just getting started</Text>
      <View style={styles.spacer} />

      <PrimaryButton title="Break 108" onPress={() => setSelectedGoal(107)} />
      <Text style={styles.hint}>For regular golfers looking to improve</Text>
      <View style={styles.spacer} />

      <PrimaryButton title="Break 100" onPress={() => setSelectedGoal(99)} />
      <Text style={styles.hint}>A milestone many golfers work towards</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 16,
    color: Colors.light.text,
  },
  helper: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  hint: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  spacer: {
    height: 16,
  },
  backLink: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.primary,
    textAlign: 'center',
    marginTop: 12,
  },
});
