import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const defaultClubs = [
  'PW',
  '9i',
  '8i',
  '7i',
  '6i',
  '5i',
  '4i',
  'Hybrid',
  '3W',
  'Driver',
];

export default function ClubSetupScreen() {
  const [distances, setDistances] = useState({});

  // Load saved clubs
  useEffect(() => {
    async function load() {
      try {
        const stored = await AsyncStorage.getItem('clubDistances');
        if (stored) {
          setDistances(JSON.parse(stored));
        } else {
          // initialise defaults
          const d = {};
          defaultClubs.forEach((c) => (d[c] = ''));
          setDistances(d);
        }
      } catch (err) {
        console.log('Error loading clubs', err);
      }
    }
    load();
  }, []);

  // Save clubs
  const saveClubs = async () => {
    try {
      await AsyncStorage.setItem('clubDistances', JSON.stringify(distances));
      alert('Saved!');
    } catch (err) {
      console.log('Error saving clubs', err);
    }
  };

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 26, marginBottom: 20 }}>My Club Distances</Text>

      {defaultClubs.map((club) => (
        <View key={club} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 18 }}>{club}</Text>
          <TextInput
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              padding: 8,
              borderRadius: 8,
              marginTop: 4,
            }}
            value={String(distances[club] ?? '')}
            onChangeText={(val) => setDistances({ ...distances, [club]: val })}
          />
        </View>
      ))}

      <Button title="Save" onPress={saveClubs} />
    </ScrollView>
  );
}
