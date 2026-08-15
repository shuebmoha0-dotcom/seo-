"use client";

import { useState } from "react";
import { resetPassword } from "@/lib/auth/actions";
import { Bot, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await resetPassword(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
    // On success, resetPassword redirects to /dashboard
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
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm mb-6">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
