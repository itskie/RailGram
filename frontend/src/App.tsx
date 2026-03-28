import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import RequireAuth from "./components/RequireAuth";
import Layout from "./components/Layout";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FeedPage from "./pages/FeedPage";
import MapPage from "./pages/MapPage";
import TrainsPage from "./pages/TrainsPage";
import TrainDetailPage from "./pages/TrainDetailPage";
import ProfilePage from "./pages/ProfilePage";
import ChatListPage from "./pages/ChatListPage";
import ChatRoomPage from "./pages/ChatRoomPage";
import LeaderboardPage from "./pages/LeaderboardPage";

export default function App() {
  const { token, loadMe } = useAuthStore();

  useEffect(() => {
    if (token) loadMe();
  }, [token, loadMe]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected */}
      <Route element={<RequireAuth />}>
        <Route
          path="/"
          element={
            <Layout>
              <FeedPage />
            </Layout>
          }
        />
        <Route
          path="/map"
          element={
            <Layout>
              <MapPage />
            </Layout>
          }
        />
        <Route
          path="/trains"
          element={
            <Layout>
              <TrainsPage />
            </Layout>
          }
        />
        <Route
          path="/trains/:trainNo"
          element={
            <Layout>
              <TrainDetailPage />
            </Layout>
          }
        />
        <Route
          path="/profile/:username"
          element={
            <Layout>
              <ProfilePage />
            </Layout>
          }
        />
        <Route
          path="/chat"
          element={
            <Layout>
              <ChatListPage />
            </Layout>
          }
        />
        <Route path="/chat/:convId" element={<ChatRoomPage />} />
        <Route
          path="/leaderboard"
          element={
            <Layout>
              <LeaderboardPage />
            </Layout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
