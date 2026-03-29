import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

/**
 * Returns a guard function. Call it before any action that requires auth.
 * If user is not logged in, redirects to /login and returns false.
 * If logged in, returns true and you can proceed.
 */
export function useLoginPrompt() {
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();

  const requireAuth = (): boolean => {
    if (user) return true;
    nav("/login");
    return false;
  };

  return { requireAuth, isLoggedIn: !!user };
}
