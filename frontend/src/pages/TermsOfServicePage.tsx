import { Link } from "react-router-dom";
import { Train } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
            <Train size={16} className="text-white" strokeWidth={2} />
          </div>
          <span className="font-black text-xl text-white">RailGram</span>
        </Link>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: April 7, 2026</p>

        <div className="space-y-8 text-zinc-400 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using RailGram (railgram.in), you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">2. Eligibility</h2>
            <p>You must be at least 13 years old to use RailGram. By creating an account, you confirm that you meet this requirement.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">3. Your Account</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You are responsible for keeping your account credentials secure.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>Do not share your account with others or create accounts on behalf of others without permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">4. Content Rules</h2>
            <p className="mb-2">You may not post content that:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Is illegal, harmful, threatening, abusive, or harassing.</li>
              <li>Violates copyright or intellectual property rights.</li>
              <li>Contains explicit, adult, or NSFW material.</li>
              <li>Spreads misinformation about Indian Railways or endangers safety.</li>
              <li>Includes personal information of others without their consent.</li>
              <li>Is spam or promotional content posted without permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">5. Content Ownership</h2>
            <p>You retain ownership of the content you post on RailGram. By posting, you grant RailGram a non-exclusive, royalty-free licence to display and distribute your content within the platform. We do not claim ownership of your photos, videos, or posts.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">6. Prohibited Activities</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Attempting to hack, scrape, or reverse-engineer the platform.</li>
              <li>Creating fake accounts or impersonating others.</li>
              <li>Using bots or automated tools to interact with the platform.</li>
              <li>Attempting to circumvent account bans or restrictions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">7. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms, without prior notice. You may also delete your account at any time from your profile settings.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">8. Disclaimers</h2>
            <p>RailGram is provided "as is". We do not guarantee uninterrupted access or that the platform will be free of errors. We are not affiliated with Indian Railways or the Ministry of Railways, Government of India.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">9. Changes to Terms</h2>
            <p>We may update these terms from time to time. Continued use of RailGram after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">10. Contact</h2>
            <p>Questions about these terms? Reach us at <a href="https://www.instagram.com/railgram.in/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300">@railgram.in on Instagram</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 flex gap-6 text-xs text-zinc-600">
          <Link to="/privacy-policy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          <Link to="/cookie-policy" className="hover:text-zinc-400 transition-colors">Cookie Policy</Link>
          <Link to="/" className="hover:text-zinc-400 transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
