import { Link } from "react-router-dom";
import { Train, Users, MapPin, Camera, Zap } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
            <Train size={16} className="text-white" strokeWidth={2} />
          </div>
          <span className="font-black text-xl text-white">RailGram</span>
        </Link>

        <h1 className="text-3xl font-bold mb-4">About RailGram</h1>
        <p className="text-zinc-400 text-base leading-relaxed mb-12">
          RailGram is India's railway social network — built by railfans, for railfans. Whether you're a loco spotter, a daily commuter, or just someone who loves the sound of a diesel honking through the ghats, this is your home.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {[
            { icon: Camera, title: "Share your spots", desc: "Post photos and reels of locos, trains, stations, and everything in between." },
            { icon: Users, title: "Connect with railfans", desc: "Follow other enthusiasts, discover new content, and build your railway community." },
            { icon: MapPin, title: "Live train tracking", desc: "See where trains are right now on a live map, powered by real-time data." },
            { icon: Zap, title: "Earn karma", desc: "Daily check-ins, badges, and a leaderboard to celebrate the most active railfans." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center mb-3">
                <Icon size={18} className="text-orange-400" />
              </div>
              <p className="text-white font-semibold text-sm mb-1">{title}</p>
              <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-12">
          <h2 className="text-white font-semibold text-lg mb-3">Our Mission</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Indian Railways is one of the largest railway networks in the world — with over 13,000 trains, 7,000+ stations, and millions of passionate people who love it. RailGram exists to give that community a dedicated space to share, connect, and celebrate the railways.
          </p>
          <p className="text-zinc-400 text-sm leading-relaxed mt-3">
            We are not affiliated with Indian Railways or the Ministry of Railways, Government of India. We are an independent platform built with love for the community.
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-white font-semibold text-lg mb-4">Get in Touch</h2>
          <div className="flex flex-col gap-3">
            <a href="https://www.instagram.com/railgram.in/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors text-sm">
              <span className="text-orange-400">Instagram</span>
              <span>@railgram.in</span>
            </a>
            <a href="https://x.com/railgram_in" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors text-sm">
              <span className="text-orange-400">X (Twitter)</span>
              <span>@railgram_in</span>
            </a>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-800 flex gap-6 text-xs text-zinc-600">
          <Link to="/privacy-policy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          <Link to="/terms-of-service" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
          <Link to="/cookie-policy" className="hover:text-zinc-400 transition-colors">Cookie Policy</Link>
          <Link to="/" className="hover:text-zinc-400 transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
