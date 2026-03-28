import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

interface DoubleTapHeartProps {
  isActive: boolean;
  onAnimationEnd?: () => void;
}

export function DoubleTapHeart({ isActive, onAnimationEnd }: DoubleTapHeartProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      // Trigger animation sequence natively on the UI thread
      opacity.value = 1;
      scale.value = withSequence(
        withSpring(1, { damping: 10, stiffness: 100 }),
        withDelay(
          400,
          withTiming(0, { duration: 200 }, () => {
             // Reset opacity and trigger cleanup callback
             opacity.value = 0;
             if (onAnimationEnd) {
               runOnJS(onAnimationEnd)();
             }
          })
        )
      );
    }
  }, [isActive, scale, opacity, onAnimationEnd]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      <Heart fill="white" color="white" size={100} strokeWidth={1} style={styles.shadow} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  }
});
