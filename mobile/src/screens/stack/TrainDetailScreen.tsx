import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { trainsApi } from '../../api/client';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'TrainDetail'>;

export default function TrainDetailScreen({ route }: Props) {
  const { trainNo } = route.params;

  const { data: train, isLoading: loadingTrain } = useQuery({
    queryKey: ['train', trainNo],
    queryFn: () => trainsApi.get(trainNo),
  });

  const { data: position, isLoading: loadingPos } = useQuery({
    queryKey: ['train-position', trainNo],
    queryFn: () => trainsApi.livePosition(trainNo),
    refetchInterval: 30_000,
  });

  if (loadingTrain) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#E53935" /></View>;
  }
  if (!train) {
    return <View style={styles.centered}><Text style={styles.errorText}>Train not found</Text></View>;
  }

  const trainTypeEmoji: Record<string, string> = {
    rajdhani: '🔵',
    shatabdi: '🟡',
    duronto: '🟠',
    express: '🟢',
    superfast: '🔴',
    passenger: '⚪',
  };
  const typeEmoji = trainTypeEmoji[train.train_type?.toLowerCase()] ?? '🚂';

  return (
    <ScrollView style={styles.container}>
      {/* Train header */}
      <View style={styles.header}>
        <Text style={styles.trainNumber}>{typeEmoji} {train.train_no}</Text>
        <Text style={styles.trainName}>{train.train_name}</Text>
        <Text style={styles.trainType}>{train.train_type?.toUpperCase()}</Text>
      </View>

      {/* Route */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Route</Text>
        <View style={styles.routeRow}>
          <View style={styles.routeStation}>
            <Text style={styles.routeCode}>{train.source_station}</Text>
            <Text style={styles.routeLabel}>Origin</Text>
          </View>
          <Text style={styles.routeArrow}>→</Text>
          <View style={styles.routeStation}>
            <Text style={styles.routeCode}>{train.destination_station}</Text>
            <Text style={styles.routeLabel}>Destination</Text>
          </View>
        </View>
      </View>

      {/* Live position */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live Status</Text>
        {loadingPos ? (
          <ActivityIndicator color="#E53935" />
        ) : position ? (
          <View style={styles.liveInfo}>
            {position.last_station && (
              <View style={styles.liveRow}>
                <Text style={styles.liveLabel}>📍 Last reported at</Text>
                <Text style={styles.liveValue}>{position.last_station}</Text>
              </View>
            )}
            {position.next_station && (
              <View style={styles.liveRow}>
                <Text style={styles.liveLabel}>⏩ Next station</Text>
                <Text style={styles.liveValue}>{position.next_station}</Text>
              </View>
            )}
            {position.speed !== undefined && (
              <View style={styles.liveRow}>
                <Text style={styles.liveLabel}>⚡ Speed</Text>
                <Text style={styles.liveValue}>{position.speed} km/h</Text>
              </View>
            )}
            {position.delay_minutes !== undefined && (
              <View style={styles.liveRow}>
                <Text style={styles.liveLabel}>🕐 Status</Text>
                <Text style={[
                  styles.liveValue,
                  { color: position.delay_minutes > 0 ? '#E53935' : '#2E7D32' },
                ]}>
                  {position.delay_minutes > 0
                    ? `${position.delay_minutes} min late`
                    : 'Running on time'}
                </Text>
              </View>
            )}
            <View style={styles.liveRow}>
              <Text style={styles.liveLabel}>🎯 Confidence</Text>
              <Text style={styles.liveValue}>{Math.round(position.confidence * 100)}%</Text>
            </View>
            <Text style={styles.updatedAt}>
              Updated: {new Date(position.updated_at).toLocaleTimeString()}
            </Text>
          </View>
        ) : (
          <Text style={styles.noData}>No live data available</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#666', fontSize: 16 },
  header: { backgroundColor: '#E53935', padding: 24, alignItems: 'center', gap: 6 },
  trainNumber: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  trainName: { fontSize: 18, color: '#fff', textAlign: 'center' },
  trainType: { fontSize: 12, color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  card: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  routeStation: { alignItems: 'center', gap: 4 },
  routeCode: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  routeLabel: { fontSize: 12, color: '#888' },
  routeArrow: { fontSize: 24, color: '#E53935' },
  liveInfo: { gap: 10 },
  liveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveLabel: { fontSize: 14, color: '#666' },
  liveValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  noData: { color: '#999', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  updatedAt: { fontSize: 11, color: '#aaa', textAlign: 'right', marginTop: 4 },
});
