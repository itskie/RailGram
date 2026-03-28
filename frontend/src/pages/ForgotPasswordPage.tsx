import { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🚂 RailGram</div>
        <h2 style={styles.title}>Forgot Password?</h2>

        {!sent ? (
          <>
            <p style={styles.subtitle}>
              Enter your registered email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label} htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
                autoFocus
              />
              {error && <p style={styles.error}>{error}</p>}
              <button type="submit" disabled={loading} style={styles.button}>
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={styles.icon}>📬</div>
            <p style={styles.subtitle}>
              If an account with <strong style={{ color: "#fff" }}>{email}</strong> exists,
              a password reset link has been sent. Check your inbox (and spam folder)!
            </p>
            <p style={{ ...styles.subtitle, fontSize: 12 }}>The link expires in 1 hour.</p>
          </>
        )}

        <Link to="/login" style={styles.link}>← Back to Login</Link>
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
  title: { color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 8px", textAlign: "center" },
  subtitle: { color: "#9ca3af", fontSize: 14, lineHeight: 1.6, textAlign: "center", marginBottom: 24 },
  icon: { fontSize: 48, textAlign: "center", marginBottom: 16 },
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
    padding: "12px 24px",
    background: "linear-gradient(135deg, #f97316, #ea580c)",
    color: "#fff",
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    marginTop: 4,
  },
  link: { display: "block", marginTop: 28, color: "#f97316", fontSize: 14, textDecoration: "none", textAlign: "center" },
};
