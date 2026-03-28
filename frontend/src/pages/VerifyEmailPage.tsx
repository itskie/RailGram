import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { auth } from "../lib/api";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No token provided in the link.");
      return;
    }
    auth
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message ?? "Invalid or expired link.");
      });
  }, [token]);

  async function handleResend() {
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      await auth.resendVerification(resendEmail);
      setResendSent(true);
    } catch {
      setResendSent(true); // show same message to prevent enumeration
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🚂 RailGram</div>

        {status === "loading" && (
          <>
            <div style={styles.spinner} />
            <p style={styles.subtitle}>Verifying your email…</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={styles.icon}>✅</div>
            <h2 style={styles.title}>Email Verified!</h2>
            <p style={styles.subtitle}>
              Your account is now active. Start exploring Indian Railways on RailGram!
            </p>
            <Link to="/login" style={styles.button}>
              Sign In
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div style={styles.icon}>❌</div>
            <h2 style={styles.title}>Verification Failed</h2>
            <p style={styles.subtitle}>{message}</p>

            {!resendSent ? (
              <div style={styles.resendBox}>
                <p style={styles.resendLabel}>Didn't get the email? Resend it:</p>
                <input
                  id="resend-email"
                  type="email"
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  style={styles.input}
                />
                <button
                  onClick={handleResend}
                  disabled={resendLoading || !resendEmail}
                  style={styles.button}
                >
                  {resendLoading ? "Sending…" : "Resend Verification Email"}
                </button>
              </div>
            ) : (
              <p style={{ ...styles.subtitle, color: "#4ade80", marginTop: 12 }}>
                If your account exists, a new verification email has been sent!
              </p>
            )}

            <Link to="/login" style={styles.link}>
              Back to Login
            </Link>
          </>
        )}
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
    textAlign: "center",
    backdropFilter: "blur(12px)",
  },
  logo: {
    fontSize: 28,
    fontWeight: 700,
    color: "#f97316",
    marginBottom: 24,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 8px" },
  subtitle: { color: "#9ca3af", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" },
  button: {
    display: "inline-block",
    width: "100%",
    padding: "12px 24px",
    background: "linear-gradient(135deg, #f97316, #ea580c)",
    color: "#fff",
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    textDecoration: "none",
    boxSizing: "border-box",
    marginTop: 8,
  },
  resendBox: { textAlign: "left", width: "100%" },
  resendLabel: { color: "#9ca3af", fontSize: 13, marginBottom: 8 },
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    marginBottom: 12,
    boxSizing: "border-box",
    outline: "none",
  },
  link: { display: "block", marginTop: 20, color: "#f97316", fontSize: 14, textDecoration: "none" },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(255,255,255,0.1)",
    borderTop: "3px solid #f97316",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto 16px",
  },
};
