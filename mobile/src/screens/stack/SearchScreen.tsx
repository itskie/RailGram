import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

export default function SearchScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['search-users', submitted],
    queryFn: async () => {
      if (!submitted) return { users: [] };
      const res = await api.get('/users/search', { params: { q: submitted, limit: 30 } });
      return res.data;
    },
    enabled: submitted.length > 0,
  });

  const users = data?.users ?? data?.items ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Search size={18} color="#666" />
        <TextInput
          style={styles.input}
          placeholder="Search users..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSubmitted(query)}
          returnKeyType="search"
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setSubmitted(''); }}>
            <X size={16} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading && <ActivityIndicator color="#FF6B35" style={{ marginTop: 24 }} />}

      <FlatList
        data={users}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: any) => {
          const letter = (item.username || '?')[0].toUpperCase();
          return (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => navigation.navigate('UserProfile', { username: item.username })}
            >
              <View style={styles.avatar}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarLetter}>{letter}</Text>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username}</Text>
                {item.display_name && <Text style={styles.displayName}>{item.display_name}</Text>}
                {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          submitted ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { alignItems: 'center', paddingTop: 60 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, backgroundColor: '#151515',
    borderRadius: 12, borderWidth: 1, borderColor: '#222',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#111',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', marginRight: 14,
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  userInfo: { flex: 1 },
  username: { color: '#fff', fontWeight: '700', fontSize: 15 },
  displayName: { color: '#888', fontSize: 13, marginTop: 1 },
  bio: { color: '#555', fontSize: 12, marginTop: 2 },
  emptyText: { color: '#444', fontSize: 14 },
});
