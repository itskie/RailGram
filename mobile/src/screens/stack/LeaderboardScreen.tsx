import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trophy, Zap, Flame, Crown, Medal } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

const RARITY_COLORS: Record<string, string> = {
  common: '#888',
  rare: '#60a5fa',
  epic: '#a78bfa',
  legendary: '#facc15',
};

export default function LeaderboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ['gam-stats', user?.username],
    queryFn: async () => {
      const res = await api.get(`/gamification/stats/${user?.username}`);
      return res.data;
    },
    enabled: !!user?.username,
  });

  const { data: lb } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await api.get('/gamification/leaderboard');
      return res.data?.entries ?? res.data ?? [];
    },
  });

  const checkinMut = useMutation({
    mutationFn: () => api.post('/gamification/checkin'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gam-stats', user?.username] }),
  });

  const top3 = (lb ?? []).slice(0, 3);
  const rest = (lb ?? []).slice(3);

  const avatarUrl = (url: string | null) =>
    url ? (url.startsWith('http') ? url : `${CDN}${url}`) : null;

  const AvatarCircle = ({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) => {
    const src = avatarUrl(url);
    return (
      <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        {src ? <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2 }} />
          : <Text style={[s.avatarText, { fontSize: size * 0.38 }]}>{name[0]?.toUpperCase()}</Text>}
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Leaderboard</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {/* My Stats */}
        {stats && (
          <View style={s.statsCard}>
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Zap size={18} color="#FF6B35" strokeWidth={2} />
                <Text style={s.statNum}>{stats.karma ?? 0}</Text>
                <Text style={s.statLabel}>Karma</Text>
              </View>
              <View style={s.statItem}>
                <Trophy size={18} color="#facc15" strokeWidth={2} />
                <Text style={s.statNum}>#{stats.karma_rank ?? '—'}</Text>
                <Text style={s.statLabel}>Rank</Text>
              </View>
              <View style={s.statItem}>
                <Flame size={18} color="#f97316" strokeWidth={2} />
                <Text style={s.statNum}>{stats.trains_spotted ?? 0}</Text>
                <Text style={s.statLabel}>Spotted</Text>
              </View>
            </View>
            <TouchableOpacity style={s.checkinBtn} onPress={() => checkinMut.mutate()} disabled={checkinMut.isPending}>
              {checkinMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.checkinText}>⚡ Daily Check-in</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Badges */}
        {stats?.badges?.length > 0 && (
          <View style={s.badgesSection}>
            <Text style={s.sectionTitle}>My Badges</Text>
            <View style={s.badgesGrid}>
              {stats.badges.map((b: any) => (
                <View key={b.id} style={[s.badge, { borderColor: RARITY_COLORS[b.rarity] + '60' }]}>
                  <Text style={s.badgeIcon}>{b.icon}</Text>
                  <Text style={[s.badgeName, { color: RARITY_COLORS[b.rarity] }]} numberOfLines={1}>{b.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top 3 */}
        {top3.length > 0 && (
          <View style={s.podium}>
            <Text style={s.sectionTitle}>Top Railfans</Text>
            <View style={s.podiumRow}>
              {[top3[1], top3[0], top3[2]].map((entry: any, idx) => {
                if (!entry) return <View key={idx} style={{ flex: 1 }} />;
                const pos = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                const iconSize = pos === 1 ? 24 : 20;
                return (
                  <TouchableOpacity key={entry.user_id} style={[s.podiumItem, pos === 1 && s.podiumFirst]} onPress={() => navigation.navigate('UserProfile', { username: entry.username })}>
                    {pos === 1 && <Crown size={22} color="#facc15" strokeWidth={2} style={{ marginBottom: 6 }} />}
                    {pos !== 1 && <Medal size={iconSize} color={pos === 2 ? '#94a3b8' : '#b45309'} strokeWidth={2} style={{ marginBottom: 4 }} />}
                    <AvatarCircle url={entry.avatar_url} name={entry.username} size={pos === 1 ? 56 : 44} />
                    <Text style={s.podiumName} numberOfLines={1}>{entry.username}</Text>
                    <Text style={s.podiumKarma}>⚡ {entry.karma}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Rest */}
        {rest.length > 0 && (
          <View style={s.restList}>
            {rest.map((entry: any, idx: number) => (
              <TouchableOpacity key={entry.user_id} style={s.restRow} onPress={() => navigation.navigate('UserProfile', { username: entry.username })}>
                <Text style={s.restRank}>#{idx + 4}</Text>
                <AvatarCircle url={entry.avatar_url} name={entry.username} size={38} />
                <View style={s.restInfo}>
                  <Text style={s.restName} numberOfLines={1}>{entry.display_name || entry.username}</Text>
                  <Text style={s.restUsername}>@{entry.username}</Text>
                </View>
                <Text style={s.restKarma}>⚡ {entry.karma}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!lb && <View style={s.center}><ActivityIndicator color="#FF6B35" /></View>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1e1e1e' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  statsCard: { backgroundColor: '#111', borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e1e1e' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statItem: { alignItems: 'center', gap: 4 },
  statNum: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  checkinBtn: { backgroundColor: '#FF6B35', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  checkinText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  badgesSection: { marginBottom: 20 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: '#111', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', minWidth: 72 },
  badgeIcon: { fontSize: 22, marginBottom: 4 },
  badgeName: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  podium: { marginBottom: 20 },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  podiumItem: { flex: 1, alignItems: 'center', backgroundColor: '#111', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e1e1e' },
  podiumFirst: { borderColor: '#facc1540', backgroundColor: '#12100a' },
  podiumName: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  podiumKarma: { color: '#FF6B35', fontSize: 11, fontWeight: '600', marginTop: 2 },
  restList: { gap: 2 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#1a1a1a' },
  restRank: { color: '#555', fontSize: 13, fontWeight: '700', width: 28, textAlign: 'center' },
  avatar: { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarText: { color: '#fff', fontWeight: '700' },
  restInfo: { flex: 1 },
  restName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  restUsername: { color: '#555', fontSize: 11, marginTop: 1 },
  restKarma: { color: '#FF6B35', fontSize: 13, fontWeight: '600' },
});
