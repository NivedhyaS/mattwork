'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Label } from '@/components/ui/label';
import Button from '@/components/ui/button';
import Link from 'next/link';
import { KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, ShieldAlert } from 'lucide-react';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = async (values: ResetPasswordValues) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', {
        token,
        password: values.password,
      });
      setSuccess(true);
      // Auto-redirect to login after 3 seconds
      setTimeout(() => router.replace('/login'), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Failed to reset password. The link may have expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (pw: string) => {
    if (!pw) return null;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { label: 'Weak', color: 'bg-rose-500', width: 'w-1/4' };
    if (score === 3) return { label: 'Fair', color: 'bg-amber-500', width: 'w-2/4' };
    if (score === 4) return { label: 'Good', color: 'bg-blue-500', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-emerald-500', width: 'w-full' };
  };
  const strength = getPasswordStrength(password);

  // If no token in URL, show invalid state
  if (!token) {
    return (
      <div className="space-y-4 py-2">
        <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <ShieldAlert className="h-5 w-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-1.5">Invalid Reset Link</h2>
          <p className="text-sm text-slate-400">
            This password reset link is missing a required token. Please request a new reset link.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-4 py-2">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-1.5">Password Updated!</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Your password has been successfully reset. You are being redirected to the sign-in page&hellip;
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-7">
        <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
          <KeyRound className="h-5 w-5 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white mb-1.5">
          Set a new password
        </h2>
        <p className="text-sm text-slate-400">
          Choose a strong password. It must be at least 8 characters and include uppercase, lowercase, and a number.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 p-3.5 border border-rose-500/20 text-rose-400 text-xs font-semibold mb-5">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* New Password */}
        <div className="space-y-2">
          <Label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            New Password
          </Label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
              <KeyRound className="h-4 w-4" />
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password')}
              className={`w-full h-12 pl-11 pr-11 rounded-xl bg-slate-950/40 border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-slate-950/80 transition-all duration-200 ${
                errors.password
                  ? 'border-rose-500/50 focus:border-rose-500'
                  : 'border-slate-800/80 hover:border-slate-700/80 focus:border-blue-500/60'
              }`}
              placeholder="••••••••"
              aria-invalid={errors.password ? 'true' : 'false'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-350 focus:outline-none cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {/* Strength bar */}
          {strength && (
            <div className="space-y-1 pt-0.5">
              <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}
                />
              </div>
              <p className={`text-[11px] font-semibold ${
                strength.label === 'Weak' ? 'text-rose-400' :
                strength.label === 'Fair' ? 'text-amber-400' :
                strength.label === 'Good' ? 'text-blue-400' :
                'text-emerald-400'
              }`}>
                {strength.label} password
              </p>
            </div>
          )}
          {errors.password && (
            <p className="text-xs text-rose-500 font-medium pl-1">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Confirm New Password
          </Label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
              <KeyRound className="h-4 w-4" />
            </span>
            <input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('confirmPassword')}
              className={`w-full h-12 pl-11 pr-11 rounded-xl bg-slate-950/40 border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-slate-950/80 transition-all duration-200 ${
                errors.confirmPassword
                  ? 'border-rose-500/50 focus:border-rose-500'
                  : 'border-slate-800/80 hover:border-slate-700/80 focus:border-blue-500/60'
              }`}
              placeholder="••••••••"
              aria-invalid={errors.confirmPassword ? 'true' : 'false'}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-350 focus:outline-none cursor-pointer"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-rose-500 font-medium pl-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button
          type="submit"
          isLoading={isLoading}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-[0_4px_20px_-2px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_25px_0px_rgba(59,130,246,0.45)] hover:-translate-y-[1px] active:translate-y-0 border-0"
        >
          Reset Password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 px-4 relative overflow-hidden select-none">
      {/* Radial Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-gradient-to-tr from-blue-600/10 to-indigo-600/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      <style>{`
        @keyframes fadeInSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-card {
          animation: fadeInSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="max-w-[450px] w-full bg-slate-900/40 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-[0_0_50px_-12px_rgba(0,0,0,0.6)] animate-card z-10 hover:border-white/10 transition-all duration-300">
        {/* Back to Login */}
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-6 transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sign In
        </Link>

        {/* Wrap in Suspense because useSearchParams requires it in Next.js App Router */}
        <Suspense fallback={
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
