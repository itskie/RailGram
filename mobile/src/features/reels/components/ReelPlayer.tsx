import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import { useReelStore } from '../../../store/reelStore';

interface ReelPlayerProps {
  id: string; // To match activeReelId
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  onRecordView?: (watchedSecs: number) => void;
}

export function ReelPlayer({ id, hlsUrl, thumbnailUrl, onRecordView }: ReelPlayerProps) {
  const videoRef = useRef<VideoRef>(null);
  const { isMuted, activeReelId } = useReelStore();
  
  // Is this specific reel the one currently on screen?
  const isActive = activeReelId === id;

  const watchTimeRef = useRef(0);
  const hasRecordedViewRef = useRef(false);

  // Manage auto-pause globally
  useEffect(() => {
    if (!isActive && !hasRecordedViewRef.current && watchTimeRef.current >= 3 && onRecordView) {
      onRecordView(Math.round(watchTimeRef.current));
      hasRecordedViewRef.current = true;
    }
    
    // reset tracking if we scroll back to it later
    if (isActive) {
      watchTimeRef.current = 0;
      hasRecordedViewRef.current = false;
    }
  }, [isActive, onRecordView]);

  return (
    <View style={styles.container}>
      {!hlsUrl && (
        <View style={styles.processing}>
          <Text style={styles.processingText}>Video Processing...</Text>
        </View>
      )}

      {hlsUrl && (
        <Video
          ref={videoRef}
          source={{ uri: hlsUrl }}
          poster={thumbnailUrl ?? undefined}
          posterResizeMode="cover"
          resizeMode="cover"
          repeat={true}
          paused={!isActive}
          muted={isMuted}
          onProgress={(e) => {
            if (isActive) watchTimeRef.current = e.currentTime;
          }}
          onEnd={() => {
            if (!hasRecordedViewRef.current && watchTimeRef.current >= 3 && onRecordView) {
              onRecordView(Math.round(watchTimeRef.current));
              hasRecordedViewRef.current = true;
            }
          }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  processing: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#71717a', // zinc-500
    fontSize: 16,
  }
});
