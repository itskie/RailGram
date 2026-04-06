import React, { useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react-native';
import { api } from '../../api/client';

export default function TrainsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['trains-search', search],
    queryFn: async () => {
      if (!search) return { trains: [] };
      const res = await api.get('/trains/search', { params: { q: search } });
      return res.data;
    },
    enabled: search.length > 0,
  });

  const trains = data?.trains ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Trains</Text>
      </View>
      <View style={styles.searchBox}>
        <Search size={18} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search train number or name..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSearch(query)}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => setSearch(query)}>
          <Text style={styles.searchBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator color="#FF6B35" style={{ marginTop: 24 }} />}

      <FlatList
        data={trains}
        keyExtractor={(item: any) => item.train_no}
        renderItem={({ item }: any) => (
          <TouchableOpacity
            style={styles.trainCard}
            onPress={() => navigation.navigate('TrainDetail', { trainNo: item.train_no })}
          >
            <View style={styles.trainRow}>
              <Text style={styles.trainNo}>{item.train_no}</Text>
              {!item.is_running_today && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Not Today</Text>
                </View>
              )}
            </View>
            <Text style={styles.trainName}>{item.name}</Text>
            <View style={styles.trainMeta}>
              {item.train_type && <Text style={styles.metaText}>{item.train_type}</Text>}
              {item.zone && <Text style={styles.metaText}>• {item.zone}</Text>}
              {item.total_distance_km && <Text style={styles.metaText}>• {item.total_distance_km} km</Text>}
            </View>
            {item.origin_code && item.destination_code && (
              <Text style={styles.route}>{item.origin_code} → {item.destination_code}</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          search ? <Text style={styles.empty}>No trains found</Text> : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🚆</Text>
              <Text style={styles.emptyText}>Search for a train by number or name</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  topBar: {
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: '#151515',
    borderRadius: 12, borderWidth: 1, borderColor: '#222', paddingLeft: 12,
  },
  searchIcon: { marginRight: 6 },
  input: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 12 },
  searchBtn: {
    backgroundColor: '#FF6B35', borderTopRightRadius: 11, borderBottomRightRadius: 11,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  trainCard: {
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1a1a1a',
  },
  trainRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  trainNo: { color: '#FF6B35', fontWeight: 'bold', fontSize: 16 },
  badge: { backgroundColor: '#1a1a1a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#888', fontSize: 11 },
  trainName: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  trainMeta: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  metaText: { color: '#555', fontSize: 12 },
  route: { color: '#888', fontSize: 13 },
  empty: { color: '#555', textAlign: 'center', padding: 48 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#444', fontSize: 14 },
});
