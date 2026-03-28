import { useInfiniteQuery } from '@tanstack/react-query';
import { reels } from '../../../lib/api';

export function useReelFeed(type: 'feed' | 'trending' = 'feed') {
  return useInfiniteQuery({
    queryKey: ['reels', type],
    queryFn: async ({ pageParam = undefined }) => {
      if (type === 'trending') {
        const data = await reels.trending();
        return data;
      }
      return reels.feed(pageParam);
    },
    initialPageParam: undefined as string | undefined, // cursor is string
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
  });
}
