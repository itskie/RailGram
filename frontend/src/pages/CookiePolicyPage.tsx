import { Link } from "react-router-dom";
import { Train } from "lucide-react";

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
            <Train size={16} className="text-white" strokeWidth={2} />
          </div>
          <span className="font-black text-xl text-white">RailGram</span>
        </Link>

        <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: April 7, 2026</p>

        <div className="space-y-8 text-zinc-400 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">1. What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and keep you logged in.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">2. How RailGram Uses Cookies</h2>
            <p className="mb-3">RailGram uses minimal, essential cookies and browser storage to operate the platform:</p>
            <div className="space-y-4">
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <p className="text-zinc-300 font-medium mb-1">Authentication Token</p>
                <p>Stored in <code className="text-orange-400 text-xs">localStorage</code> — keeps you logged in between sessions. This is essential for the platform to function. Cleared when you log out.</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <p className="text-zinc-300 font-medium mb-1">Muted Stories Preference</p>
                <p>Stored in <code className="text-orange-400 text-xs">localStorage</code> — remembers which users' stories you have muted. Purely a UI preference.</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <p className="text-zinc-300 font-medium mb-1">Session State</p>
                <p>Temporary in-memory state (not persisted to disk) used to manage your current session — e.g., which stories you've already seen.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">3. What We Don't Use</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>We do <strong className="text-zinc-300">not</strong> use advertising or tracking cookies.</li>
              <li>We do <strong className="text-zinc-300">not</strong> use third-party analytics cookies (e.g., Google Analytics).</li>
              <li>We do <strong className="text-zinc-300">not</strong> share cookie data with any third party.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">4. Managing Your Preferences</h2>
            <p>You can clear your browser's localStorage at any time through your browser settings. This will log you out of RailGram and reset your preferences. You can also log out from your profile to clear your authentication token.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">5. Contact</h2>
            <p>Questions about our cookie use? Reach us at <a href="https://www.instagram.com/railgram.in/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300">@railgram.in on Instagram</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 flex gap-6 text-xs text-zinc-600">
          <Link to="/privacy-policy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          <Link to="/terms-of-service" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
          <Link to="/" className="hover:text-zinc-400 transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
