import React from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { api } from '../../api/client';

export default function TrainDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { trainNo } = route.params;

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['train-schedule', trainNo],
    queryFn: async () => {
      const res = await api.get(`/trains/${trainNo}/schedule`);
      return res.data;
    },
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#FF6B35" size="large" /></View>;
  }

  if (!schedule) {
    return <View style={styles.center}><Text style={styles.errText}>Train not found</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={22} color="#FF6B35" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.trainNo}>{schedule.train_no}</Text>
        <Text style={styles.trainName}>{schedule.name}</Text>
        <View style={styles.metaRow}>
          {schedule.train_type && <Text style={styles.metaTag}>{schedule.train_type}</Text>}
          {schedule.zone && <Text style={styles.metaTag}>{schedule.zone}</Text>}
          {schedule.total_distance_km && <Text style={styles.metaTag}>{schedule.total_distance_km} km</Text>}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Schedule — {schedule.stops?.length || 0} stops</Text>

      <FlatList
        data={schedule.stops}
        keyExtractor={(item: any) => String(item.sequence)}
        renderItem={({ item, index }: any) => (
          <View style={styles.stopRow}>
            <View style={styles.stopLeft}>
              <View style={[styles.dot, (index === 0 || index === schedule.stops.length - 1) && styles.dotTerminal]} />
              {index < schedule.stops.length - 1 && <View style={styles.line} />}
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stationCode}>{item.station_code}</Text>
              <Text style={styles.stationName}>{item.station_name}</Text>
              {item.city && <Text style={styles.city}>{item.city}</Text>}
            </View>
            <View style={styles.stopTimes}>
              {item.arrival_time && <Text style={styles.time}>{item.arrival_time}</Text>}
              {item.departure_time && item.departure_time !== item.arrival_time && (
                <Text style={styles.timeDep}>{item.departure_time}</Text>
              )}
              {item.day > 1 && <Text style={styles.day}>D{item.day}</Text>}
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  errText: { color: '#888' },
  header: {
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: '#0f0f0f', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backText: { color: '#FF6B35', fontSize: 15 },
  trainNo: { color: '#FF6B35', fontSize: 24, fontWeight: 'bold' },
  trainName: { color: '#fff', fontSize: 17, fontWeight: '600', marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  metaTag: {
    backgroundColor: '#1a1a1a', color: '#888',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11,
  },
  sectionTitle: { color: '#444', fontSize: 11, fontWeight: '700', padding: 16, textTransform: 'uppercase', letterSpacing: 1 },
  stopRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 4, minHeight: 56 },
  stopLeft: { width: 20, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#444', marginTop: 8 },
  dotTerminal: { backgroundColor: '#FF6B35', width: 10, height: 10, borderRadius: 5 },
  line: { width: 1.5, flex: 1, backgroundColor: '#222', marginTop: 3 },
  stopInfo: { flex: 1, paddingLeft: 14, paddingBottom: 8 },
  stationCode: { color: '#FF6B35', fontWeight: '700', fontSize: 13 },
  stationName: { color: '#ddd', fontSize: 13, marginTop: 2 },
  city: { color: '#555', fontSize: 11, marginTop: 1 },
  stopTimes: { alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 6, gap: 2 },
  time: { color: '#aaa', fontSize: 12 },
  timeDep: { color: '#777', fontSize: 11 },
  day: { color: '#FF6B35', fontSize: 10, marginTop: 2 },
});
