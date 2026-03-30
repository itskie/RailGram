import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { token?: string };
  ResetPassword: { token?: string };
  // Main (tabs wrapper)
  Main: undefined;
  // Stack screens
  PostDetail: { postId: string };
  ReelDetail: { reelId: string };
  TrainDetail: { trainNo: string };
  UserProfile: { username: string };
  Stories: { username: string };
  Leaderboard: undefined;
  ChatRoom: { conversationId: string };
  StoryCreation: undefined;
  ReelUpload: undefined;
  Notifications: undefined;
  EditProfile: undefined;
  Search: undefined;
};

export type TabParamList = {
  Feed: undefined;
  Reels: undefined;
  TrainMap: undefined;
  Chat: undefined;
  Profile: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> =
  BottomTabScreenProps<TabParamList, T>;
