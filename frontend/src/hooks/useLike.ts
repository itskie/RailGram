import { useMutation, useQueryClient } from '@tanstack/react-query';
import { posts as postsApi, reels as reelsApi } from '../lib/api';

export type LikeTarget = 'post' | 'reel' | 'post_comment' | 'reel_comment';

interface UseLikeOptions {
  target: LikeTarget;
  targetId: string;
  postId?: string; // For comments, provide the parent post/reel id
  onSuccess?: (response: { liked: boolean; like_count?: number; likes_count?: number }) => void;
  onError?: (error: Error) => void;
}

interface LikeResponse {
  liked?: boolean;
  like_count?: number;
  likes_count?: number;
}

/**
 * Unified hook for handling likes across all content types (posts, reels, comments)
 * Provides real-time count updates from server response
 */
export function useLike(options: UseLikeOptions) {
  const qc = useQueryClient();
  const { target, targetId, postId, onSuccess, onError } = options;

  return useMutation({
    mutationFn: async () => {
      switch (target) {
        case 'post':
          return postsApi.like(targetId) as Promise<LikeResponse>;
        
        case 'reel':
          return reelsApi.like(targetId) as Promise<LikeResponse>;
        
        case 'post_comment':
          return postsApi.likeComment(targetId) as Promise<LikeResponse>;
        
        case 'reel_comment':
          return reelsApi.likeComment(targetId) as Promise<LikeResponse>;
        
        default:
          throw new Error(`Unknown like target: ${target}`);
      }
    },
    onSuccess: (response) => {
      // Invalidate relevant caches
      if (target === 'post' || target === 'post_comment') {
        qc.invalidateQueries({ queryKey: ['feed'] });
        qc.invalidateQueries({ queryKey: ['post', targetId] });
        if (postId) {
          qc.invalidateQueries({ queryKey: ['post-comments', postId] });
        }
      } else if (target === 'reel' || target === 'reel_comment') {
        qc.invalidateQueries({ queryKey: ['reels'] });
        qc.invalidateQueries({ queryKey: ['reel', targetId] });
        if (postId) {
          qc.invalidateQueries({ queryKey: ['reel-comments', postId] });
        }
      }
      
      onSuccess?.(response);
    },
    onError: (error) => {
      onError?.(error as Error);
    }
  });
}
