'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

// ─────────────────────────────────────────────
// SIGN UP
// ─────────────────────────────────────────────
export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  if (!email || !password || !name) {
    return { error: 'All fields are required.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'An account with this email already exists. Please log in.' };
    }
    return { error: error.message };
  }

  // Auto-create default project for the new user
  // (The DB trigger handles inserting the users row)
  return { success: 'Account created! Please check your email to verify.' };
}

// ─────────────────────────────────────────────
// SIGN IN
// ─────────────────────────────────────────────
export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Incorrect email or password.' };
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: 'Please verify your email before logging in.' };
    }
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

// ─────────────────────────────────────────────
// SIGN OUT
// ─────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

// ─────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────
export async function forgotPassword(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Email is required.' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: 'Password reset email sent! Check your inbox.' };
}

// ─────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────
export async function resetPassword(formData: FormData) {
  const supabase = await createClient();

  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!password || !confirmPassword) {
    return { error: 'Both password fields are required.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}
