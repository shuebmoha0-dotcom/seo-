"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Lock, Mail, User, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();
  const supabase = createClient();
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Dev bypass — no real Supabase connected yet
    if (isPlaceholder) {
      router.push("/dashboard");
      return;
    }

    try {
      if (isSignUp) {
        if (!name.trim()) { setError("Please enter your name."); setLoading(false); return; }
        if (password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            setError("An account with this email already exists. Try logging in.");
          } else {
            setError(error.message);
          }
        } else {
          setSuccess("Account created! Check your email to verify before logging in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setError("Incorrect email or password.");
          } else if (error.message.includes("Email not confirmed")) {
            setError("Please verify your email first. Check your inbox.");
          } else {
            setError(error.message);
          }
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      }
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left: Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-purple-300 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SEO Autopilot</span>
          </div>

          <h1 className="text-4xl font-black text-white leading-tight mb-6">
            Your autonomous<br />SEO employee,<br />working 24/7.
          </h1>
          <p className="text-indigo-200 text-lg leading-relaxed max-w-sm">
            AI agents that research, write, optimize, and monitor — while you stay in control with human approval on every consequential action.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { value: "18,247", label: "Organic clicks tracked" },
            { value: "135+", label: "Agent files deployed" },
            { value: "24/7", label: "Autonomous monitoring" },
            { value: "100%", label: "Human-approved changes" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-indigo-200 text-xs font-medium mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 sm:px-16 lg:px-20">
        <div className="max-w-md w-full mx-auto">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-neutral-900">SEO Autopilot</span>
          </div>

          <h2 className="text-2xl font-bold text-neutral-900 mb-1">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-neutral-500 text-sm mb-8">
            {isSignUp ? "Start your autonomous SEO journey." : "Sign in to your SEO command centre."}
          </p>

          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm mb-6">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-sm mb-6">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            {/* Name field (sign up only) */}
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-neutral-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-neutral-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  Password
                </label>
                {!isSignUp && (
                  <Link href="/forgot-password" className="text-xs text-indigo-600 hover:underline font-medium">
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? "At least 8 characters" : "Your password"}
                  required
                  className="w-full pl-10 pr-10 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-neutral-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Create Account" : "Sign In"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-6">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccess(null); }}
              className="text-indigo-600 font-semibold hover:underline"
            >
              {isSignUp ? "Sign in" : "Sign up free"}
            </button>
          </p>

          {isPlaceholder && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
              <strong>Dev Mode:</strong> Supabase not connected. Click Sign In to preview the dashboard directly.{" "}
              <Link href="/SUPABASE_SETUP.md" className="underline">Setup guide →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
