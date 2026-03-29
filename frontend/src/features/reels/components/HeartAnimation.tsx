import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

interface HeartAnimationProps {
  isVisible: boolean;
  onComplete: () => void;
}

export function HeartAnimation({ isVisible, onComplete }: HeartAnimationProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1.5, 1.2, 1.5, 0], 
            opacity: [0, 1, 1, 1, 0],
            rotate: [0, -10, 10, -10, 0]
          }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          onAnimationComplete={onComplete}
          className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-20"
        >
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 blur-2xl bg-white/30 rounded-full scale-150" />
            
            <Heart 
              size={120} 
              className="fill-white text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" 
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
