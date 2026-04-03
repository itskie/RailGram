import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import RequireAuth from "./components/RequireAuth";
import Layout from "./components/Layout";
import { ReelsPage } from "./pages/reels/ReelsPage";

// Lazy load heavy pages
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const TrainsPage = lazy(() => import("./pages/TrainsPage"));
const TrainDetailPage = lazy(() => import("./pages/TrainDetailPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const EditProfilePage = lazy(() => import("./pages/EditProfilePage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const FollowRequestsPage = lazy(() => import("./pages/FollowRequestsPage"));
const BlockedUsersPage = lazy(() => import("./pages/BlockedUsersPage"));
const ChatListPage = lazy(() => import("./pages/ChatListPage"));
const ChatRoomPage = lazy(() => import("./pages/ChatRoomPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const PostCommentsPage = lazy(() => import("./pages/PostCommentsPage"));
const StationDetailPage = lazy(() => import("./pages/StationDetailPage"));
const ReelUploadPage = lazy(() => import("./pages/reels/ReelUploadPage").then(module => ({ default: module.ReelUploadPage })));
const LandingPage = lazy(() => import("./pages/LandingPage"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
    </div>
  );
}

function RootRoute() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Layout><FeedPage /></Layout>;
  return <LandingPage />;
}

export default function App() {
  const { init } = useAuthStore();

  useEffect(() => {
    // Initialize CSRF and load current user on app mount
    init();
  }, [init]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Root — Landing for guests, Feed for logged-in */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/reels" element={<Layout><ReelsPage /></Layout>} />
        <Route path="/search" element={<Layout><SearchPage /></Layout>} />
        <Route path="/discover" element={<Layout><DiscoverPage /></Layout>} />
        <Route path="/profile/:username" element={<Layout><ProfilePage /></Layout>} />
        <Route path="/map" element={<Layout><MapPage /></Layout>} />
        <Route path="/trains" element={<Layout><TrainsPage /></Layout>} />
        <Route path="/trains/:trainNo" element={<Layout><TrainDetailPage /></Layout>} />
        <Route path="/stations/:code" element={<Layout><StationDetailPage /></Layout>} />
        <Route path="/leaderboard" element={<Layout><LeaderboardPage /></Layout>} />

        {/* Protected — login required */}
        <Route element={<RequireAuth />}>
          <Route path="/posts/:postId/comments" element={<PostCommentsPage />} />
          <Route path="/reels/upload" element={<Layout><ReelUploadPage /></Layout>} />
          <Route path="/profile/edit" element={<Layout><EditProfilePage /></Layout>} />
          <Route path="/notifications" element={<Layout><NotificationsPage /></Layout>} />
          <Route path="/follow-requests" element={<Layout><FollowRequestsPage /></Layout>} />
          <Route path="/blocked-users" element={<Layout><BlockedUsersPage /></Layout>} />
          <Route path="/chat" element={<Layout><ChatListPage /></Layout>} />
          <Route path="/chat/:convId" element={<ChatRoomPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
