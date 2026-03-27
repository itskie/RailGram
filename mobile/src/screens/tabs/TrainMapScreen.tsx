import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useQuery } from '@tanstack/react-query';
import { trainsApi } from '../../api/client';
import type { LivePosition } from '../../types';
import type { TabScreenProps } from '../../navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TrainMapScreen(_: TabScreenProps<'TrainMap'>) {
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LivePosition | null>(null);

  const { data: livePositions, isLoading } = useQuery({
    queryKey: ['live-positions'],
    queryFn: () => trainsApi.allLivePositions(),
    refetchInterval: 60_000, // refresh every 60s
  });

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ['train-search', search],
    queryFn: () => trainsApi.search(search),
    enabled: search.trim().length > 1,
  });

  const trains = livePositions ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search train number or name..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator color="#E53935" style={{ marginRight: 10 }} />}
      </View>

      {/* Search Results */}
      {search.length > 1 && searchResults && searchResults.length > 0 && (
        <View style={styles.results}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {searchResults.map((t) => (
              <TouchableOpacity
                key={t.train_no}
                style={styles.resultRow}
                onPress={() => {
                  setSearch('');
                  navigation.navigate('TrainDetail', { trainNo: t.train_no });
                }}
              >
                <Text style={styles.resultNo}>{t.train_no}</Text>
                <Text style={styles.resultName} numberOfLines={1}>{t.train_name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 22.5,
          longitude: 80.0,
          latitudeDelta: 25,
          longitudeDelta: 25,
        }}
      >
        {trains.map((pos) => (
          <Marker
            key={pos.train_no}
            coordinate={{ latitude: pos.lat, longitude: pos.lng }}
            onPress={() => setSelected(pos)}
          >
            <Text style={styles.trainMarker}>🚂</Text>
          </Marker>
        ))}
      </MapView>

      {/* Selected train info panel */}
      {selected && (
        <View style={styles.infoPanel}>
          <View style={styles.infoPanelHeader}>
            <Text style={styles.infoPanelTitle}>🚂 {selected.train_no}</Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.infoPanelClose}>✕</Text>
            </TouchableOpacity>
          </View>
          {selected.last_station && (
            <Text style={styles.infoPanelRow}>📍 Last: {selected.last_station}</Text>
          )}
          {selected.next_station && (
            <Text style={styles.infoPanelRow}>⏩ Next: {selected.next_station}</Text>
          )}
          {selected.delay_minutes !== undefined && (
            <Text style={[styles.infoPanelRow, { color: selected.delay_minutes > 0 ? '#E53935' : '#2E7D32' }]}>
              {selected.delay_minutes > 0 ? `⚠️ ${selected.delay_minutes}m late` : '✅ On time'}
            </Text>
          )}
          <TouchableOpacity
            style={styles.infoPanelBtn}
            onPress={() => { setSelected(null); navigation.navigate('TrainDetail', { trainNo: selected.train_no }); }}
          >
            <Text style={styles.infoPanelBtnText}>View Details →</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#E53935" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    position: 'absolute', top: 10, left: 10, right: 10, zIndex: 10,
    backgroundColor: '#fff', borderRadius: 10, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
    elevation: 4,
  },
  searchInput: { flex: 1, padding: 12, fontSize: 15, color: '#111' },
  results: {
    position: 'absolute', top: 58, left: 10, right: 10, zIndex: 10,
    backgroundColor: '#fff', borderRadius: 10, maxHeight: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
    elevation: 4,
  },
  resultRow: { flexDirection: 'row', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  resultNo: { fontSize: 13, fontWeight: '700', color: '#E53935', minWidth: 60 },
  resultName: { fontSize: 13, color: '#333', flex: 1 },
  map: { flex: 1 },
  trainMarker: { fontSize: 24 },
  infoPanel: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 8, gap: 6,
  },
  infoPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoPanelTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  infoPanelClose: { fontSize: 18, color: '#666', padding: 4 },
  infoPanelRow: { fontSize: 14, color: '#444' },
  infoPanelBtn: { backgroundColor: '#E53935', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 4 },
  infoPanelBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
});
