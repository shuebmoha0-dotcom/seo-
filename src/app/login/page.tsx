"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Bot, Lock, Mail, User, Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound, RefreshCw } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: 'signup',
      });

      if (otpError) {
        setError(otpError.message);
      } else {
        setSuccess("Email verified successfully! Redirecting...");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1000);
      }
    } catch (err: any) {
      setError("Failed to verify code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        }
      });
      if (resendError) {
        setError(resendError.message);
      } else {
        setSuccess("Verification email resent! Please check your inbox and spam folder.");
      }
    } catch (err: any) {
      setError("Failed to resend confirmation email.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      } else if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize Google Sign In.");
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Dev bypass if placeholder
    if (isPlaceholder) {
      router.push("/dashboard");
      return;
    }

    try {
      if (isSignUp) {
        if (!name.trim()) { setError("Please enter your name."); setLoading(false); return; }
        if (password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }

        const { data, error } = await supabase.auth.signUp({
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
        } else if (data.session) {
          // If auto-confirm is enabled in Supabase
          router.push("/dashboard");
          router.refresh();
        } else {
          // Awaiting email verification
          setIsVerifyingOtp(true);
          setSuccess("Confirmation sent to " + email + ". Click the link in the email or enter the 6-digit code below.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setError("Incorrect email or password.");
          } else if (error.message.includes("Email not confirmed")) {
            setIsVerifyingOtp(true);
            setError("Please verify your email before logging in. You can enter the 6-digit code or resend the link.");
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
      <div className="hidden lg:flex lg:w-1/2 bg-neutral-900 border-r border-neutral-800 flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="mb-14">
            <BrandLogo size="lg" href="/" textColor="text-white" />
          </div>

          <h1 className="text-3xl font-semibold text-white leading-tight mb-4 tracking-tight">
            Autonomous search growth for ambitious teams.
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed max-w-md">
            Continuous technical auditing, keyword cluster mapping, and structured article drafting — with strict human approval workflows.
          </p>
        </div>

        <div className="relative z-10 border-t border-neutral-800/80 pt-8">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-medium text-neutral-400">Strict Human Approvals</div>
              <div className="text-xs text-neutral-500 mt-1 leading-normal">
                No changes or articles are published to production without explicit verification.
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-neutral-400">Multi-CMS Connectors</div>
              <div className="text-xs text-neutral-500 mt-1 leading-normal">
                Direct synchronization with WordPress, GitHub repos, and custom API webhooks.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 sm:px-16 lg:px-20">
        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8 lg:hidden">
            <BrandLogo size="md" href="/" />
          </div>

          <h2 className="text-xl font-semibold text-neutral-900 mb-1 tracking-tight">
            {isVerifyingOtp ? "Verify your email" : isSignUp ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-neutral-500 text-xs mb-6">
            {isVerifyingOtp 
              ? "Enter the 6-digit code sent to " + email
              : isSignUp 
                ? "Get started with your autonomous SEO agent." 
                : "Sign in to manage your connected properties."}
          </p>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs mb-5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg text-xs mb-5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {isVerifyingOtp ? (
            /* OTP Code Verification Form */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    maxLength={10}
                    required
                    className="w-full pl-9 pr-3 h-9 bg-white border border-neutral-300 rounded-lg text-neutral-900 text-sm font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-colors placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !otpCode.trim()}
                className="w-full h-9 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60 text-white rounded-lg font-medium text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={loading}
                  className="text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Resend code
                </button>
                <button
                  type="button"
                  onClick={() => { setIsVerifyingOtp(false); setError(null); setSuccess(null); }}
                  className="text-neutral-500 hover:text-neutral-800"
                >
                  Back to login
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* 1-Click Google OAuth */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-10 bg-white hover:bg-neutral-50 border border-neutral-300 hover:border-neutral-400 text-neutral-800 rounded-lg font-medium text-xs transition-all shadow-xs flex items-center justify-center gap-2.5 cursor-pointer mb-5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isSignUp ? "Sign up with Google" : "Continue with Google"}</span>
              </button>

              <div className="relative flex items-center justify-center mb-5">
                <div className="border-t border-neutral-200 w-full" />
                <span className="bg-white px-2.5 text-[10px] uppercase tracking-wider font-semibold text-neutral-400 absolute">
                  or with email
                </span>
              </div>

              {/* Sign In / Sign Up Form */}
              <form onSubmit={handleAuth} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      className="w-full pl-9 pr-3 h-9 bg-white border border-neutral-300 rounded-lg text-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-colors placeholder:text-neutral-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full pl-9 pr-3 h-9 bg-white border border-neutral-300 rounded-lg text-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-colors placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-neutral-700">
                    Password
                  </label>
                  {!isSignUp && (
                    <Link href="/forgot-password" className="text-xs text-neutral-500 hover:text-neutral-900 font-medium transition-colors">
                      Forgot?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-8 h-9 bg-white border border-neutral-300 rounded-lg text-neutral-900 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-colors placeholder:text-neutral-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60 text-white rounded-lg font-medium text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 mt-2"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isSignUp ? "Create account" : "Sign in"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

          {!isVerifyingOtp && (
            <p className="text-center text-xs text-neutral-500 mt-5">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccess(null); }}
                className="text-neutral-900 font-medium hover:underline"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
