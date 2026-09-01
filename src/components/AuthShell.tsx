'use client';
import React, { useState } from 'react';
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  User,
  MapPin,
  ExternalLink,
  Navigation,
  Layers,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  CheckCircle2,
  Building2,
  Activity,
} from 'lucide-react';
import { HOSPITAL_NAME, SECTION_NAME } from '@/lib/assets';
import { AppUser } from '@/lib/types';

interface AuthShellProps {
  onLoginSuccess: (token: string, user: AppUser) => void;
}

export default function AuthShell({ onLoginSuccess }: AuthShellProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Interactive Map State
  const [mapType, setMapType] = useState<'m' | 'k' | 'h'>('m'); // m = Roadmap, k = Satellite, h = Hybrid
  const [zoomLevel, setZoomLevel] = useState<number>(16);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to sign in.');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err?.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickFillAdmin() {
    setUsername('admin');
    setPassword('Admin!Balamban2026');
  }

  const mapEmbedUrl = `https://maps.google.com/maps?q=Cebu+Provincial+Hospital+-+Balamban,+Aliwanay,+Balamban,+Cebu&t=${mapType}&z=${zoomLevel}&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-slate-950 text-slate-100 selection:bg-brand-blue selection:text-white">
      {/* Brand Hero & Interactive Large Map Panel (Left 7 Cols) */}
      <div className="lg:col-span-7 bg-gradient-to-br from-[#061426] via-[#0b2240] to-[#034078] text-white p-6 sm:p-10 xl:p-12 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
        {/* Background Ambient Glows */}
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center justify-between gap-4 relative z-10 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center p-0.5 shadow-xl overflow-hidden shrink-0 ring-2 ring-white/40">
              <img src="/cebu_seal.png" alt="Province of Cebu Seal" className="w-full h-full object-contain" />
            </div>
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center p-0.5 shadow-xl overflow-hidden shrink-0 ring-2 ring-white/40">
              <img src="/cph_logo.png" alt="Hospital Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">{HOSPITAL_NAME}</h2>
              <p className="text-[11px] sm:text-xs text-sky-200 font-semibold">{SECTION_NAME} · Province of Cebu</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black backdrop-blur-md shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            System Live
          </div>
        </div>

        {/* Middle: Hero Title & Interactive Map */}
        <div className="my-6 space-y-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-sky-300 text-[11px] font-black tracking-wider uppercase mb-2.5 backdrop-blur-md border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Automated Deadlines & Compliance Monitor
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Hospital Transmittals, <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-300">
                Precision & Timely Control.
              </span>
            </h1>
          </div>

          {/* Large Interactive Google Map Container */}
          <div className="rounded-3xl overflow-hidden border border-white/20 bg-slate-900/60 backdrop-blur-xl shadow-2xl p-4 space-y-3">
            {/* Map Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-white">Pilapil St., Balamban, Cebu</p>
                  <p className="text-[10px] text-sky-200 font-medium">GPS: 10.4938° N, 123.7100° E</p>
                </div>
              </div>

              {/* Interactive Map Controls */}
              <div className="flex items-center gap-1.5">
                {/* Map Type Switcher */}
                <div className="bg-white/10 p-0.5 rounded-xl border border-white/15 flex items-center text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setMapType('m')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      mapType === 'm' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapType('k')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      mapType === 'k' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Satellite
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapType('h')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      mapType === 'h' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Hybrid
                  </button>
                </div>

                {/* Zoom In / Out */}
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(20, prev + 1))}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/15"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(12, prev - 1))}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/15"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                {/* Open in Google Maps */}
                <a
                  href="https://maps.app.goo.gl/LMRU9CCkq1fSjJw8A"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-xl bg-sky-500 hover:bg-sky-600 text-[11px] font-black text-white shadow-md transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Navigation className="w-3 h-3" />
                  Navigate
                  <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                </a>
              </div>
            </div>

            {/* The Embedded Interactive Google Map (Extra Large & Immersive) */}
            <div className="relative w-full h-[380px] sm:h-[440px] lg:h-[480px] xl:h-[540px] rounded-2xl overflow-hidden border border-white/15 shadow-inner group">
              <iframe
                title="Cebu Provincial Hospital Balamban Interactive Map"
                src={mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full filter contrast-[1.05]"
              />

              {/* Floating Helper Pill */}
              <div className="absolute bottom-2.5 right-2.5 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-[10px] text-slate-300 font-semibold pointer-events-none">
                👆 Drag & scroll to explore Balamban
              </div>
            </div>
          </div>
        </div>

        {/* Footer info pills */}
        <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-sky-200">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-bold">
              <Building2 className="w-3.5 h-3.5 text-sky-300" />
              Balamban, Cebu
            </span>
            <span className="flex items-center gap-1.5 font-bold">
              <Activity className="w-3.5 h-3.5 text-emerald-300" />
              PhilHealth 60-Day Cutoff
            </span>
          </div>
          <span className="text-[11px] text-slate-400">© 2026 Cebu Provincial Hospital</span>
        </div>
      </div>

      {/* Interactive Login Card Panel (Right 5 Cols) */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-2xl p-7 sm:p-9 rounded-3xl border border-white/15 shadow-2xl relative overflow-hidden">
          {/* Top glowing ambient line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-brand-blue to-emerald-400" />

          {/* Form Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-blue to-sky-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Staff Portal</h2>
                <p className="text-xs text-slate-400 font-semibold">Sign in to manage transmittals</p>
              </div>
            </div>

            {/* Quick Demo Autofill Button */}
            <button
              type="button"
              onClick={handleQuickFillAdmin}
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-sky-300 text-[10px] font-black border border-white/10 transition-all cursor-pointer"
              title="Autofill default admin credentials"
            >
              Demo Auto-fill
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold leading-relaxed animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. admin or staff username"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-white/15 bg-slate-800/80 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all placeholder:text-slate-500"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-4 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-11 py-3.5 rounded-2xl border border-white/15 bg-slate-800/80 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all placeholder:text-slate-500"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-4 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-brand-blue to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-black shadow-xl shadow-sky-500/25 hover:shadow-sky-500/35 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer mt-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Sign In to HealthLink Hub
                </>
              )}
            </button>
          </form>

          {/* Security details & Google Maps Shortcut */}
          <div className="mt-6 pt-5 border-t border-white/10 space-y-2 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              🔒 End-to-end encrypted session with salted hash authentication
            </p>
            <a
              href="https://maps.app.goo.gl/LMRU9CCkq1fSjJw8A"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline pt-1"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              Open Hospital Location on Google Maps
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
