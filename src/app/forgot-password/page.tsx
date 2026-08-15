"use client";

import { useState } from "react";
import { forgotPassword } from "@/lib/auth/actions";
import { Bot, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    const res = await forgotPassword(formData);
    setResult(res);
    setLoading(false);
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
            <h1 className="text-2xl font-bold text-neutral-900 mb-1">Reset your password</h1>
            <p className="text-neutral-500 text-sm">
              Enter your email and we'll send a reset link.
            </p>
          </div>

          {result?.error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm mb-6">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{result.error}</span>
            </div>
          )}

          {result?.success ? (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Email sent!</p>
                <p className="mt-1">{result.success}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    placeholder="you@company.com"
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
                  "Send Reset Link"
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-neutral-500 hover:text-indigo-600 flex items-center gap-1.5 justify-center transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
