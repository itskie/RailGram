import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { auth } from "../lib/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await auth.resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setError(err.message ?? "Invalid or expired link. Please request a new reset link.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>🚂 RailGram</div>
          <div style={styles.icon}>✅</div>
          <h2 style={styles.title}>Password Reset!</h2>
          <p style={styles.subtitle}>
            Your password has been updated successfully. Redirecting you to login…
          </p>
          <Link to="/login" style={styles.button}>Go to Login Now</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🚂 RailGram</div>
        <h2 style={styles.title}>Set New Password</h2>
        <p style={styles.subtitle}>Choose a strong new password for your account.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            style={styles.input}
            autoFocus
          />

          <label style={styles.label} htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading || !token} style={styles.button}>
            {loading ? "Saving…" : "Reset Password"}
          </button>
        </form>

        <Link to="/forgot-password" style={styles.link}>Request a new reset link</Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
    padding: 16,
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "48px 40px",
    maxWidth: 420,
    width: "100%",
    backdropFilter: "blur(12px)",
  },
  logo: { fontSize: 28, fontWeight: 700, color: "#f97316", textAlign: "center", marginBottom: 24 },
  icon: { fontSize: 48, textAlign: "center", marginBottom: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 8px", textAlign: "center" },
  subtitle: { color: "#9ca3af", fontSize: 14, lineHeight: 1.6, textAlign: "center", marginBottom: 24 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { color: "#d1d5db", fontSize: 13, fontWeight: 500 },
  input: {
    padding: "11px 14px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    outline: "none",
  },
  error: { color: "#f87171", fontSize: 13, margin: 0 },
  button: {
    display: "inline-block",
    padding: "12px 24px",
    background: "linear-gradient(135deg, #f97316, #ea580c)",
    color: "#fff",
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center",
    marginTop: 4,
  },
  link: { display: "block", marginTop: 20, color: "#6b7280", fontSize: 13, textDecoration: "none", textAlign: "center" },
};
