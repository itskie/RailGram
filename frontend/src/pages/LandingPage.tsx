import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  Train, Play, MapPin, Shield, Zap, Users, Star,
  ArrowRight, Camera, Radio, Trophy, ChevronDown,
} from "lucide-react";

// ── Floating train particle ───────────────────────────────────────────────────
function TrainParticle({ delay, duration, top, opacity }: { delay: number; duration: number; top: string; opacity: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ top, opacity }}
      initial={{ x: "-10vw" }}
      animate={{ x: "110vw" }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear", repeatDelay: Math.random() * 5 }}
    >
      <Train size={20} className="text-orange-500/30" />
    </motion.div>
  );
}

// ── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, gradient }: { icon: any; title: string; desc: string; gradient: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative group rounded-3xl p-px overflow-hidden"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative bg-zinc-900/80 backdrop-blur-sm rounded-3xl p-7 h-full border border-zinc-800/60 group-hover:border-transparent transition-colors duration-300">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 shadow-lg`}>
          <Icon size={22} className="text-white" strokeWidth={1.8} />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="flex flex-col items-center gap-1"
    >
      <span className="text-3xl md:text-4xl font-black text-white">{value}</span>
      <span className="text-zinc-500 text-sm font-medium">{label}</span>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const features = [
    {
      icon: Camera,
      title: "Loco Spotting Reports",
      desc: "Share detailed locomotive spotting reports with class, road number, shed, and zone metadata. Built for serious railfans.",
      gradient: "from-orange-500 to-red-500",
    },
    {
      icon: Play,
      title: "Railway Reels",
      desc: "Short-form HD videos of trains in action. Scroll through an endless vertical feed of the best rail footage in India.",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: MapPin,
      title: "Live Train Tracking",
      desc: "Real-time train positions using GPS + cell tower triangulation. Works even inside tunnels via signal strength algorithms.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Radio,
      title: "Cell Tower Triangulation",
      desc: "Crowdsourced 5G/LTE tower calibration from users delivers accurate positions where GPS fails — tunnels, deep cuts, stations.",
      gradient: "from-green-500 to-emerald-500",
    },
    {
      icon: Trophy,
      title: "Karma & Leaderboard",
      desc: "Earn karma for spotting reports, reels, and travels. Climb the global leaderboard and unlock exclusive railfan badges.",
      gradient: "from-yellow-500 to-orange-500",
    },
    {
      icon: Shield,
      title: "Privacy First",
      desc: "Private accounts, follow requests, granular block system. Your content, your rules — full Instagram-level privacy controls.",
      gradient: "from-slate-500 to-zinc-500",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 py-4">
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm" />
        <Link to="/" className="relative flex items-center gap-2.5 z-10">
          <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Train size={18} className="text-white" strokeWidth={2} />
          </div>
          <span className="font-black text-xl text-white tracking-tight">RailGram</span>
        </Link>
        <div className="relative flex items-center gap-3 z-10">
          <Link
            to="/login"
            className="text-zinc-300 hover:text-white text-sm font-semibold transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-orange-500/30 active:scale-95"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">

        {/* Background gradient */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(249,115,22,0.15),transparent)]" />
          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
        </div>

        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]" />

        {/* Floating trains */}
        <TrainParticle delay={0} duration={18} top="20%" opacity={0.6} />
        <TrainParticle delay={4} duration={24} top="45%" opacity={0.4} />
        <TrainParticle delay={8} duration={20} top="70%" opacity={0.5} />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-8"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-orange-400 text-xs font-bold tracking-widest uppercase">India's Railway Social Network</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6"
          >
            Where{" "}
            <span className="relative">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">Railfans</span>
              <motion.span
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              />
            </span>
            {" "}meet<br />the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 to-zinc-200">Iron Road</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-2xl mb-10"
          >
            Share loco spotting reports, post Railway Reels, track live train positions,
            and connect with India's most passionate rail community.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <Link
              to="/register"
              className="group flex items-center gap-2.5 bg-orange-500 hover:bg-orange-400 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all hover:shadow-2xl hover:shadow-orange-500/30 active:scale-95"
            >
              Get started — it's free
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 text-zinc-400 hover:text-white font-semibold text-base px-6 py-4 rounded-2xl border border-zinc-800 hover:border-zinc-600 transition-all"
            >
              <Users size={16} />
              Already a member? Log in
            </Link>
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute -bottom-24 flex flex-col items-center gap-2"
          >
            <span className="text-zinc-600 text-xs tracking-widest uppercase">Explore</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ChevronDown size={20} className="text-zinc-600" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Hero preview cards */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6 }}
          style={{ y: useTransform(scrollYProgress, [0, 1], ["0%", "15%"]) }}
          className="relative z-10 mt-24 w-full max-w-5xl mx-auto px-4"
        >
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { label: "WAP-7 #30527", sub: "Itarsi Shed · CR", color: "from-orange-500/20 to-transparent" },
              { label: "12951 Mumbai Rajdhani", sub: "Departing NDLS · On Time", color: "from-blue-500/20 to-transparent", tall: true },
              { label: "Shatabdi Express", sub: "Platform 4 · NZM", color: "from-purple-500/20 to-transparent" },
            ].map((card, i) => (
              <div
                key={i}
                className={`relative bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden backdrop-blur-sm ${card.tall ? "row-span-1 md:-mt-6 md:mb-6" : ""}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-b ${card.color}`} />
                <div className="relative p-4 md:p-5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 mb-3 flex items-center justify-center">
                    <Train size={14} className="text-orange-400" />
                  </div>
                  <p className="text-white text-xs md:text-sm font-bold leading-snug">{card.label}</p>
                  <p className="text-zinc-500 text-[10px] md:text-xs mt-0.5">{card.sub}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-zinc-700" />
                    <div className="h-1.5 w-12 bg-zinc-800 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-y border-zinc-800/50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
          <StatChip value="1.8M+" label="Cell Towers" />
          <StatChip value="10K+" label="Train Routes" />
          <StatChip value="500+" label="Stations" />
          <StatChip value="∞" label="Railfan Stories" />
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-orange-400 text-xs font-black tracking-widest uppercase mb-3">Everything you need</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
              Built for the<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">Iron Road community</span>
            </h2>
            <p className="text-zinc-500 text-base max-w-xl mx-auto">
              Every feature designed specifically for Indian railway enthusiasts — from casual commuters to hardcore loco spotters.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-zinc-950">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-orange-400 text-xs font-black tracking-widest uppercase mb-3">Simple as a train ticket</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              Start in 3 steps
            </h2>
          </motion.div>
          <div className="relative">
            {/* Line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-orange-500/50 via-orange-500/20 to-transparent -translate-x-px hidden md:block" />
            {[
              { step: "01", title: "Create your account", desc: "Sign up free in under 30 seconds. No railway pass required.", icon: Users },
              { step: "02", title: "Follow railfans & trains", desc: "Discover spotters near your zone. Follow routes you travel daily.", icon: Star },
              { step: "03", title: "Share & track", desc: "Post your spotting reports, upload Reels, track your train live.", icon: Zap },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`relative flex items-start gap-6 mb-12 md:mb-16 ${i % 2 === 0 ? "md:pr-1/2 md:text-right md:flex-row-reverse" : "md:pl-1/2"}`}
              >
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <item.icon size={20} className="text-orange-400" strokeWidth={1.8} />
                </div>
                <div>
                  <span className="text-orange-500/60 text-xs font-black tracking-widest">{item.step}</span>
                  <h3 className="text-white font-bold text-lg mt-0.5 mb-1">{item.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-[2.5rem] overflow-hidden"
          >
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-red-500/10 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(249,115,22,0.3),transparent)]" />
            <div className="absolute inset-0 border border-orange-500/20 rounded-[2.5rem]" />

            {/* Floating trains in banner */}
            <div className="absolute inset-0 overflow-hidden">
              <TrainParticle delay={0} duration={12} top="30%" opacity={0.3} />
              <TrainParticle delay={5} duration={16} top="65%" opacity={0.2} />
            </div>

            <div className="relative z-10 text-center py-20 px-8">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="inline-flex mb-6"
              >
                <Train size={48} className="text-orange-400" strokeWidth={1.5} />
              </motion.div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
                All aboard, railfan.
              </h2>
              <p className="text-zinc-400 text-base md:text-lg mb-10 max-w-xl mx-auto">
                Join thousands of railway enthusiasts already sharing, tracking, and celebrating India's iron road.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/register"
                  className="group flex items-center gap-2.5 bg-orange-500 hover:bg-orange-400 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all hover:shadow-2xl hover:shadow-orange-500/40 active:scale-95"
                >
                  Create free account
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="text-zinc-400 hover:text-white font-semibold text-base px-6 py-4 rounded-2xl border border-zinc-700 hover:border-zinc-500 transition-all"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 pt-16 pb-10 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Top row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <Train size={16} className="text-white" strokeWidth={2} />
                </div>
                <span className="font-black text-xl text-white">RailGram</span>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
                India's Railway Social Network — connecting railfans, loco spotters, and everyday commuters across the iron road.
              </p>
              {/* Social icons */}
              <div className="flex items-center gap-3 mt-6">
                {/* Instagram */}
                <a
                  href="https://www.instagram.com/railgram.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-gradient-to-br hover:from-purple-500 hover:via-pink-500 hover:to-orange-400 flex items-center justify-center transition-all duration-300 group"
                  aria-label="Instagram"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-400 group-hover:text-white transition-colors">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>

                {/* X / Twitter */}
                <a
                  href="https://x.com/railgram_in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-black flex items-center justify-center transition-all duration-300 group border border-transparent hover:border-zinc-600"
                  aria-label="X (Twitter)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-400 group-hover:text-white transition-colors">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>

                {/* LinkedIn */}
                <a
                  href="https://www.linkedin.com/company/railgram/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-[#0077b5] flex items-center justify-center transition-all duration-300 group"
                  aria-label="LinkedIn"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-400 group-hover:text-white transition-colors">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Product links */}
            <div>
              <p className="text-white font-bold text-sm mb-4 uppercase tracking-widest">Product</p>
              <div className="flex flex-col gap-3">
                <Link to="/register" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Sign Up</Link>
                <Link to="/login" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Log In</Link>
                <Link to="/reels" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Reels</Link>
                <Link to="/leaderboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Leaderboard</Link>
                <Link to="/search" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Train Search</Link>
              </div>
            </div>

            {/* About */}
            <div>
              <p className="text-white font-bold text-sm mb-4 uppercase tracking-widest">About</p>
              <div className="flex flex-col gap-3">
                <span className="text-zinc-500 text-sm">Built for Indian railfans</span>
                <span className="text-zinc-500 text-sm">AWS · ap-south-1</span>
                <span className="text-zinc-500 text-sm">FastAPI + React</span>
                <a
                  href="https://www.instagram.com/railgram.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  Contact us
                </a>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="border-t border-zinc-800/60 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-zinc-600 text-sm">
              © 2026 RailGram · India's Railway Social Network
            </p>
            <p className="text-zinc-700 text-xs">
              Built with ❤️ for the Iron Road community
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
