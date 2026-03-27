import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { gamificationApi } from '../../api/client';
import type { LeaderboardEntry } from '../../types';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'Leaderboard'>;

const RANK_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

const RANK_EMOJIS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

function LeaderboardRow({ entry, onPress }: { entry: LeaderboardEntry; onPress: () => void }) {
  const isTop3 = entry.rank <= 3;
  return (
    <TouchableOpacity style={[styles.row, isTop3 && styles.rowTop3]} onPress={onPress}>
      <View style={[styles.rankBadge, isTop3 && { backgroundColor: RANK_COLORS[entry.rank] }]}>
        <Text style={styles.rankText}>
          {RANK_EMOJIS[entry.rank] ?? `#${entry.rank}`}
        </Text>
      </View>

      <View style={styles.avatar}>
        {entry.user.avatar_url ? (
          <Image source={{ uri: entry.user.avatar_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>{entry.user.display_name[0].toUpperCase()}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.displayName} numberOfLines={1}>{entry.user.display_name}</Text>
        <Text style={styles.username}>@{entry.user.username}</Text>
      </View>

      <View style={styles.scoreCol}>
        <Text style={styles.karma}>{entry.karma_points.toLocaleString()}</Text>
        <Text style={styles.karmaLabel}>karma</Text>
        {entry.badge_count > 0 && (
          <Text style={styles.badges}>🏅 {entry.badge_count}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function LeaderboardScreen({ navigation }: Props) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: gamificationApi.leaderboard,
  });

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#E53935" /></View>;
  }
  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load leaderboard</Text>
        <TouchableOpacity onPress={() => refetch()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(e) => e.user.username}
      renderItem={({ item }) => (
        <LeaderboardRow
          entry={item}
          onPress={() => navigation.navigate('UserProfile', { username: item.user.username })}
        />
      )}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderTitle}>🏆 Top Railfans</Text>
          <Text style={styles.listHeaderSub}>Based on karma points earned</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: '#f5f5f5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#666', fontSize: 16, marginBottom: 12 },
  retryText: { color: '#E53935', fontSize: 15, fontWeight: '600' },
  listHeader: { padding: 20, alignItems: 'center', backgroundColor: '#fff', marginBottom: 8 },
  listHeaderTitle: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  listHeaderSub: { fontSize: 13, color: '#888', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, gap: 12 },
  rowTop3: { backgroundColor: '#FFFDE7' },
  rankBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontSize: 16, fontWeight: 'bold' },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  info: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '600', color: '#111' },
  username: { fontSize: 12, color: '#888', marginTop: 2 },
  scoreCol: { alignItems: 'flex-end', gap: 2 },
  karma: { fontSize: 16, fontWeight: 'bold', color: '#E53935' },
  karmaLabel: { fontSize: 11, color: '#888' },
  badges: { fontSize: 12, color: '#666' },
  separator: { height: 1, backgroundColor: '#f0f0f0' },
});
