"use client";

import { useState, useEffect } from "react";
import { resetPassword } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Bot, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const rawErr = searchParams.get("error_description") || hashParams.get("error_description") || searchParams.get("error") || hashParams.get("error");
      if (rawErr) {
        const decoded = decodeURIComponent(rawErr.replace(/\+/g, " "));
        setError(decoded.includes("expired") || decoded.includes("invalid") ? "This reset link has expired or has already been used. Please request a new one." : decoded);
      }

      const c = searchParams.get("code");
      if (c) {
        setCode(c);
        const supabase = createClient();
        supabase.auth.exchangeCodeForSession(c).then(({ error: exErr }) => {
          if (exErr) {
            console.warn("[ResetPassword] Client code exchange:", exErr.message);
          }
        });
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!password || !confirmPassword) {
      setError("Both password fields are required.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    // 1. Try client-side update first (covers hash-based recovery tokens & active sessions)
    try {
      const supabase = createClient();
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }
      const { error: clientErr } = await supabase.auth.updateUser({ password });
      if (!clientErr) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1500);
        return;
      }
      console.warn("[ResetPassword] Client updateUser:", clientErr.message);
    } catch (err) {
      console.warn("[ResetPassword] Client exception:", err);
    }

    // 2. Fallback to server action
    if (code) {
      formData.set("code", code);
    }
    const res = await resetPassword(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-white">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-10 justify-center">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-neutral-900 text-lg">SEO Autopilot</span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-neutral-900 mb-1">Set a new password</h1>
            <p className="text-neutral-500 text-sm">Must be at least 8 characters.</p>
          </div>

          {error && (
            <div className="flex flex-col gap-2 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <a href="/forgot-password" className="text-xs font-semibold text-red-800 hover:text-red-900 underline ml-7">
                Request a new reset link &rarr;
              </a>
            </div>
          )}

          {success ? (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-sm mb-6">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Password updated successfully!</p>
                <p className="text-xs text-emerald-600 mt-0.5">Redirecting to your dashboard...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="At least 8 characters"
                    required
                    className="w-full pl-10 pr-10 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-neutral-400"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Repeat your new password"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
