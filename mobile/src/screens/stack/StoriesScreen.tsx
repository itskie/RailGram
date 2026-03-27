import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, StatusBar,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { storiesApi } from '../../api/client';
import type { Story } from '../../types';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'Stories'>;

const { width: W, height: H } = Dimensions.get('window');
const STORY_DURATION = 5000; // ms

export default function StoriesScreen({ route, navigation }: Props) {
  const { username } = route.params;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const { data: feed, isLoading } = useQuery({
    queryKey: ['stories-feed'],
    queryFn: storiesApi.feed,
  });

  const viewMutation = useMutation({
    mutationFn: (id: string) => storiesApi.view(id),
  });

  // Find this user's story group
  const group = feed?.find((g) => g.user.username === username);
  const stories = group?.stories ?? [];
  const current = stories[currentIndex];

  // Auto-advance timer
  useEffect(() => {
    if (!current) return;
    viewMutation.mutate(current.id);
    setProgress(0);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = elapsed / STORY_DURATION;
      if (p >= 1) {
        clearInterval(interval);
        if (currentIndex < stories.length - 1) {
          setCurrentIndex((i) => i + 1);
        } else {
          navigation.goBack();
        }
      } else {
        setProgress(p);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [currentIndex, current?.id]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: '#fff' }}>No stories</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Story image */}
      <Image source={{ uri: current.media_url }} style={styles.media} resizeMode="cover" />

      {/* Dark overlay gradient suggestion */}
      <View style={styles.overlay} />

      {/* Progress bars */}
      <View style={styles.progressRow}>
        {stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              {
                width: i < currentIndex ? '100%' : i === currentIndex ? `${progress * 100}%` : '0%',
              },
            ]} />
          </View>
        ))}
      </View>

      {/* Author header */}
      <View style={styles.header}>
        <View style={styles.authorAvatar}>
          <Text style={styles.authorAvatarText}>{group?.user.display_name[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.authorName}>{group?.user.display_name}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tap zones: prev / next */}
      <View style={styles.tapZones}>
        <TouchableOpacity
          style={styles.tapLeft}
          onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        />
        <TouchableOpacity
          style={styles.tapRight}
          onPress={() => {
            if (currentIndex < stories.length - 1) {
              setCurrentIndex((i) => i + 1);
            } else {
              navigation.goBack();
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  media: { position: 'absolute', width: W, height: H },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.3)' },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 54 },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingTop: 8, gap: 10 },
  authorAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  authorAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  authorName: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  closeBtn: { padding: 8 },
  closeBtnText: { color: '#fff', fontSize: 18 },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', top: 120 },
  tapLeft: { flex: 1 },
  tapRight: { flex: 1 },
});
