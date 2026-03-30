import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../api/client';
import type { User } from '../../types';
import type { RootStackScreenProps } from '../../navigation/types';
import { Search as SearchIcon, User as UserIcon } from 'lucide-react-native';

type Props = RootStackScreenProps<'Search'>;

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isLoading } = useQuery<User[]>({
    queryKey: ['user-search', debouncedQuery],
    queryFn: () => usersApi.search(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  });

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <SearchIcon size={18} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username or name..."
          placeholderTextColor="#aaa"
          autoFocus
          autoCapitalize="none"
          returnKeyType="search"
        />
        {isLoading && query.length > 0 && (
          <ActivityIndicator size="small" color="#E53935" style={styles.spinner} />
        )}
      </View>

      {/* Empty state */}
      {!debouncedQuery ? (
        <View style={styles.emptyState}>
          <SearchIcon size={48} color="#ddd" />
          <Text style={styles.emptyTitle}>Discover Railfans</Text>
          <Text style={styles.emptySubtitle}>
            Type a name or username to find other railfans and explore their spots.
          </Text>
        </View>
      ) : results?.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No results for "{debouncedQuery}"</Text>
          <Text style={styles.emptySubtitle}>Try a different username or display name</Text>
        </View>
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(u) => u.id}
          renderItem={({ item: user }) => (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => navigation.navigate('UserProfile', { username: user.username })}
              activeOpacity={0.7}
            >
              <View style={styles.avatarWrap}>
                {user.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>
                      {user.display_name[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{user.display_name}</Text>
                <Text style={styles.username}>@{user.username}</Text>
              </View>
              <View style={styles.karmaChip}>
                <Text style={styles.karmaText}>⚡ {user.karma_points ?? 0}</Text>
              </View>
            </TouchableOpacity>
          )}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, paddingHorizontal: 14,
    backgroundColor: '#f5f5f5', borderRadius: 14,
    borderWidth: 1, borderColor: '#eee',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#111' },
  spinner: { marginLeft: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#444', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 20 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  avatarWrap: {},
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  userInfo: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '600', color: '#111' },
  username: { fontSize: 13, color: '#888', marginTop: 2 },
  karmaChip: {
    backgroundColor: '#FFF3F3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  karmaText: { fontSize: 12, color: '#E53935', fontWeight: '600' },
});
