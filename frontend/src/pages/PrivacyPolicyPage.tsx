import { Link } from "react-router-dom";
import { Train } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
            <Train size={16} className="text-white" strokeWidth={2} />
          </div>
          <span className="font-black text-xl text-white">RailGram</span>
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: April 7, 2026</p>

        <div className="space-y-8 text-zinc-400 text-sm leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-3">1. Introduction</h2>
            <p>RailGram ("we", "us", or "our") is India's railway social network, built by railfans for railfans. This Privacy Policy explains how we collect, use, and protect your information when you use our platform at railgram.in.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">2. Information We Collect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong className="text-zinc-300">Account info:</strong> Username, email address, and password (hashed — we never store plain text passwords).</li>
              <li><strong className="text-zinc-300">Profile info:</strong> Display name, bio, profile photo, favourite train, home station.</li>
              <li><strong className="text-zinc-300">Content:</strong> Posts, reels, stories, and comments you create.</li>
              <li><strong className="text-zinc-300">Activity:</strong> Likes, saves, follows, and other interactions.</li>
              <li><strong className="text-zinc-300">Media:</strong> Photos and videos you upload, stored securely on AWS S3.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide and operate the RailGram platform.</li>
              <li>To personalise your feed and recommendations.</li>
              <li>To send notifications about activity on your account.</li>
              <li>To improve our services and fix bugs.</li>
              <li>We do <strong className="text-zinc-300">not</strong> sell your personal data to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">4. Data Storage</h2>
            <p>Your data is stored on AWS infrastructure (RDS for database, S3 for media, EC2 for application servers) located in the Asia Pacific (Mumbai) region. We use industry-standard encryption in transit (HTTPS/TLS) and at rest.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">5. Data Retention</h2>
            <p>We retain your data as long as your account is active. You may delete your account at any time from your profile settings. Upon deletion, your posts, profile, and personal data will be permanently removed within 30 days.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">6. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li><strong className="text-zinc-300">AWS S3:</strong> Media storage</li>
              <li><strong className="text-zinc-300">AWS CloudFront:</strong> Content delivery (CDN)</li>
              <li><strong className="text-zinc-300">AWS RDS:</strong> Database hosting</li>
            </ul>
            <p className="mt-2">These services have their own privacy policies. We do not share your data with any advertising networks or data brokers.</p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">7. Your Rights</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Access and download your data.</li>
              <li>Correct inaccurate profile information.</li>
              <li>Delete your account and all associated data.</li>
              <li>Block other users from viewing your profile or content.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-3">8. Contact</h2>
            <p>For any privacy-related questions or concerns, contact us at <a href="https://www.instagram.com/railgram.in/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300">@railgram.in on Instagram</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 flex gap-6 text-xs text-zinc-600">
          <Link to="/terms-of-service" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
          <Link to="/cookie-policy" className="hover:text-zinc-400 transition-colors">Cookie Policy</Link>
          <Link to="/" className="hover:text-zinc-400 transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
