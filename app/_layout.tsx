import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { runMigrations } from '../utils/migrations';

function HomeButton() {
  return (
    <TouchableOpacity
      onPress={() => router.push('/')}
      style={styles.homeButton}
    >
      <Text style={styles.homeButtonText}>🏠 Home</Text>
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  useEffect(() => {
    runMigrations();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'YourPar' }} />
      <Stack.Screen
        name="goal"
        options={{
          title: 'Select Goal',
          headerRight: () => <HomeButton />,
        }}
      />
      <Stack.Screen
        name="par-card"
        options={{
          title: 'Your Par Card',
          headerRight: () => <HomeButton />,
        }}
      />
      <Stack.Screen
        name="hole"
        options={{
          title: 'Round',
          headerRight: () => <HomeButton />,
        }}
      />
      <Stack.Screen
        name="clubs"
        options={{
          title: 'My Clubs',
          headerRight: () => <HomeButton />,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerRight: () => <HomeButton />,
        }}
      />
      <Stack.Screen
        name="course-select"
        options={{
          title: 'Course Selection',
          headerRight: () => <HomeButton />,
        }}
      />
      <Stack.Screen
        name="course-entry"
        options={{
          title: 'Enter Course',
          headerRight: () => <HomeButton />,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  homeButton: {
    marginRight: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#243447',
  },
});
