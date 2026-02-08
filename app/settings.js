import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { typography } from '../constants/ui';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';

const STORAGE_KEY_UNITS = 'distanceUnits';

export default function SettingsScreen() {
  const [useYards, setUseYards] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAssumptions, setShowAssumptions] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_UNITS);
        if (stored !== null) {
          setUseYards(stored === 'yards');
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const toggleUnits = async (value) => {
    try {
      const newUnits = value ? 'yards' : 'meters';
      await AsyncStorage.setItem(STORAGE_KEY_UNITS, newUnits);
      setUseYards(value);
    } catch (e) {
      console.error('Error saving units setting:', e);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text>Loading settings…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Distance Units</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Use Yards</Text>
            <Text style={styles.settingDescription}>
              Display all distances in yards instead of meters
            </Text>
          </View>
          <Switch value={useYards} onValueChange={toggleUnits} />
        </View>
      </View>

      <Pressable
        style={styles.assumptionsRow}
        onPress={() => setShowAssumptions(true)}
      >
        <Text style={styles.assumptionsLink}>Assumptions (read this)</Text>
      </Pressable>

      <Modal
        visible={showAssumptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssumptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assumptions</Text>
            <Text style={styles.modalBody}>
              YourPar works best when you can:
            </Text>
            <Text style={styles.modalBullet}>
              {'\u2022'} advance the ball roughly 130m / 150yd on most shots
              (doesn&apos;t need to be Driver)
            </Text>
            <Text style={styles.modalBullet}>
              {'\u2022'} two-putt most greens once you&apos;re on
            </Text>
            <Text style={[styles.modalBody, { marginTop: 16 }]}>
              If you&apos;re not there yet, that&apos;s totally normal.
              You&apos;ll get more value from YourPar once you&apos;ve built a
              reliable &quot;get it down there&quot; shot and basic lag putting.
            </Text>
            <View style={{ marginTop: 24 }}>
              <PrimaryButton
                title="Close"
                onPress={() => setShowAssumptions(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 24,
    color: Colors.light.text,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: typography.titleM.fontFamily,
    marginBottom: 16,
    color: Colors.light.text,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    marginBottom: 4,
    color: Colors.light.text,
  },
  settingDescription: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: typography.meta.fontFamily,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  assumptionsRow: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  assumptionsLink: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: typography.titleXL.fontFamily,
    color: Colors.light.text,
    marginBottom: 16,
  },
  modalBody: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  modalBullet: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: typography.body.fontFamily,
    color: Colors.light.text,
    lineHeight: 22,
    marginBottom: 4,
    paddingLeft: 8,
  },
});
