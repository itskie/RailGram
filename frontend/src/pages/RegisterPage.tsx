import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Train } from "lucide-react";

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "", display_name: "" });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const nav = useNavigate();

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username)) {
      setError("Username can only have letters, numbers, and underscores (_). No spaces allowed.");
      return;
    }
    setLoading(true);
    try {
      await register(form.username, form.email, form.password, form.display_name);
      nav("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 text-orange-400 font-bold text-2xl mb-8">
          <Train size={28} />
          RailGram
        </div>
        <form onSubmit={submit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-center">Join RailGram</h1>
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}
          {[
            { label: "Username", field: "username", type: "text", hint: "Letters, numbers, underscore only. No spaces." },
            { label: "Display name (optional)", field: "display_name", type: "text" },
            { label: "Email", field: "email", type: "email" },
            { label: "Password", field: "password", type: "password", hint: "Min 8 characters" },
          ].map(({ label, field, type, hint }) => (
            <div key={field} className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">{label}</label>
              <input
                type={type}
                value={(form as Record<string, string>)[field]}
                onChange={set(field)}
                required={field !== "display_name"}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500 transition-colors"
              />
              {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
            </div>
          ))}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-orange-500"
            />
            <span className="text-xs text-zinc-400 leading-relaxed">
              I agree to RailGram's{" "}
              <Link to="/terms-of-service" target="_blank" className="text-orange-400 hover:underline">Terms of Service</Link>
              {" "}and{" "}
              <Link to="/privacy-policy" target="_blank" className="text-orange-400 hover:underline">Privacy Policy</Link>
            </span>
          </label>
          <button
            type="submit"
            disabled={loading || !agreed}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
          <p className="text-center text-xs text-zinc-500">
            Already have an account?{" "}
            <Link to="/login" className="text-orange-400 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
