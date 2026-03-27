/**
 * Deep Linking Configuration for React Navigation
 * Handles URL schemes: railgram://... and https://railgram.in/...
 */

import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    prefix,
    'railgram://',
    'https://railgram.in',
    'https://www.railgram.in',
  ],

  config: {
    screens: {
      // Auth screens
      Login: 'login',
      Register: 'register',
      ForgotPassword: 'forgot-password',

      // Main app
      Main: '',

      // Stack screens
      PostDetail: 'posts/:postId',
      TrainDetail: 'trains/:trainNo',
      UserProfile: 'profile/:username',
      Stories: 'stories/:username',
      Leaderboard: 'leaderboard',
      ChatRoom: 'messages/:conversationId',
      StoryCreation: 'stories/create',
    },
  },

  // Parse deep links
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url != null) {
      return url;
    }
    // Handle background notification deep links
    if (typeof window !== 'undefined' && window.opener) {
      return window.location.href;
    }
    return undefined;
  },

  // Handle deep links when app is in foreground
  subscribe(listener) {
    const linkingSubscription = Linking.addEventListener('url', (event: any) => {
      listener(event.url);
    });

    return () => {
      linkingSubscription.remove();
    };
  },
};

/**
 * Convert a screen route to a deep link URL
 * Usage: getDeepLink('PostDetail', { postId: '123' })
 */
export function getDeepLink(
  screen: keyof RootStackParamList,
  params: any = {}
): string {
  const baseUrl = 'https://railgram.in';

  switch (screen) {
    case 'PostDetail':
      return `${baseUrl}/posts/${params.postId}`;
    case 'TrainDetail':
      return `${baseUrl}/trains/${params.trainNo}`;
    case 'UserProfile':
      return `${baseUrl}/profile/${params.username}`;
    case 'Stories':
      return `${baseUrl}/stories/${params.username}`;
    case 'Leaderboard':
      return `${baseUrl}/leaderboard`;
    case 'ChatRoom':
      return `${baseUrl}/messages/${params.conversationId}`;
    case 'StoryCreation':
      return `${baseUrl}/stories/create`;
    case 'Main':
      return baseUrl;
    case 'Login':
      return `${baseUrl}/login`;
    case 'Register':
      return `${baseUrl}/register`;
    case 'ForgotPassword':
      return `${baseUrl}/forgot-password`;
    default:
      return baseUrl;
  }
}

/**
 * Parse a deep link URL to extract route and params
 * Usage: const { route, params } = parseDeepLink(url)
 */
export function parseDeepLink(url: string): { route: keyof RootStackParamList; params: any } | null {
  try {
    const { hostname, pathname } = new URL(url);

    // Handle railgram:// scheme
    if (url.startsWith('railgram://')) {
      const path = url.replace('railgram://', '');
      return parsePathToRoute(path);
    }

    // Handle https://railgram.in or https://www.railgram.in
    if (hostname === 'railgram.in' || hostname === 'www.railgram.in') {
      return parsePathToRoute(pathname);
    }

    return null;
  } catch (err) {
    console.error('Failed to parse deep link:', err);
    return null;
  }
}

/**
 * Parse a path like '/posts/123' to route and params
 */
function parsePathToRoute(path: string): { route: keyof RootStackParamList; params: any } | null {
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) {
    return { route: 'Main', params: {} };
  }

  const [segment, id] = parts;

  switch (segment) {
    case 'posts':
      if (id) return { route: 'PostDetail', params: { postId: id } };
      break;

    case 'trains':
      if (id) return { route: 'TrainDetail', params: { trainNo: id } };
      break;

    case 'profile':
      if (id) return { route: 'UserProfile', params: { username: id } };
      break;

    case 'stories':
      if (id === 'create') {
        return { route: 'StoryCreation', params: {} };
      } else if (id) {
        return { route: 'Stories', params: { username: id } };
      }
      break;

    case 'leaderboard':
      return { route: 'Leaderboard', params: {} };

    case 'messages':
      if (id) return { route: 'ChatRoom', params: { conversationId: id } };
      break;

    case 'login':
      return { route: 'Login', params: {} };

    case 'register':
      return { route: 'Register', params: {} };

    case 'forgot-password':
      return { route: 'ForgotPassword', params: {} };
  }

  return null;
}
