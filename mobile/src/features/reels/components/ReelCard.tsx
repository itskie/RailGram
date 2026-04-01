import React, { useRef, useState } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { VolumeX, Volume2 } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { Reel } from '../types/reel';
import { ReelPlayer } from './ReelPlayer';
import { ReelOverlay } from './ReelOverlay';
import { ReelActionBar } from './ReelActionBar';
import { DoubleTapHeart } from './DoubleTapHeart';
import { ReelCommentsModal } from './ReelCommentsModal';
import { useReelActions } from '../hooks/useReelActions';
import { useReelStore } from '../../../store/reelStore';

const { height } = Dimensions.get('window');

interface ReelCardProps {
  reel: Reel;
}

export function ReelCard({ reel }: ReelCardProps) {
  const { recordView, toggleLike } = useReelActions();
  const { isMuted, toggleMute } = useReelStore();
  const [showHeart, setShowHeart] = useState(false);
  const [showMuteIndicator, setShowMuteIndicator] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [localLiked, setLocalLiked] = useState(reel.viewer_liked);
  const [localViews, setLocalViews] = useState(reel.views);

  // Single Tap = Mute toggle
  const singleTap = Gesture.Tap()
    .maxDuration(250)
    .onStart(() => {
      toggleMute();
      setShowMuteIndicator(true);
      setTimeout(() => setShowMuteIndicator(false), 1500);
    });

  // Double Tap = Like
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onStart(() => {
      if (!localLiked) {
        toggleLike({ id: reel.id, isLiked: false });
        setLocalLiked(true);
      }
      setShowHeart(true);
    });

  // Exclusive gesture recognition: Require single tap to wait for double tap to fail
  const gestures = Gesture.Exclusive(doubleTap, singleTap);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gestures}>
        <View style={styles.videoWrapper}>
          <ReelPlayer
            id={reel.id}
            hlsUrl={reel.hls_url}
            thumbnailUrl={reel.thumbnail_url}
            onRecordView={(secs) => {
              recordView({ id: reel.id, watched_secs: secs });
              setLocalViews((v) => v + 1);
            }}
          />

          <ReelOverlay reel={reel} />

          <DoubleTapHeart
            isActive={showHeart}
            onAnimationEnd={() => setShowHeart(false)}
          />

          {showMuteIndicator && (
             <Animated.View
               entering={FadeIn.duration(200)}
               exiting={FadeOut.duration(300)}
               style={styles.muteIndicator}
             >
               {isMuted ? <VolumeX color="white" size={32} /> : <Volume2 color="white" size={32} />}
             </Animated.View>
          )}
        </View>
      </GestureDetector>

      <ReelActionBar
        reel={reel}
        onCommentClick={() => setShowComments(true)}
        viewsOverride={localViews}
      />

      <ReelCommentsModal
        visible={showComments}
        reelId={reel.id}
        onClose={() => setShowComments(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height, // Full screen snap
    width: '100%',
    backgroundColor: 'black',
  },
  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  muteIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 40,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    top: '45%',
  }
});
