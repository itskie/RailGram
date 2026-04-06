export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Reels: undefined;
  Trains: undefined;
  TrainMap: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  PostDetail: { postId: string };
  TrainDetail: { trainNo: string };
  UserProfile: { username: string };
  TrainTracker: { trainNo: string };
  EditProfile: undefined;
  FollowRequests: undefined;
  BlockedUsers: undefined;
  Leaderboard: undefined;
  ChatList: undefined;
  ChatRoom: { convId: string; username: string };
  Notifications: undefined;
  Search: undefined;
};
