'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Label } from '@/components/ui/label';
import Button from '@/components/ui/button';
import Link from 'next/link';
import { Mail, AlertCircle, CheckCircle2, ExternalLink, ArrowLeft } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/forgot-password', values);
      const data = res.data?.data;
      // Show dev link only if the server returned one (server-side guard)
      if (data?.devResetLink) {
        setDevResetLink(data.devResetLink);
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

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

        {!submitted ? (
          <>
            {/* Header */}
            <div className="mb-7">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white mb-1.5">
                Forgot your password?
              </h2>
              <p className="text-sm text-slate-400">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 p-3.5 border border-rose-500/20 text-rose-400 text-xs font-semibold mb-5">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Email Address
                </Label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    className={`w-full h-12 pl-11 pr-4 rounded-xl bg-slate-950/40 border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-slate-950/80 transition-all duration-200 ${
                      errors.email
                        ? 'border-rose-500/50 focus:border-rose-500'
                        : 'border-slate-800/80 hover:border-slate-700/80 focus:border-blue-500/60'
                    }`}
                    aria-invalid={errors.email ? 'true' : 'false'}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-rose-500 font-medium mt-1 pl-1">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-[0_4px_20px_-2px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_25px_0px_rgba(59,130,246,0.45)] hover:-translate-y-[1px] active:translate-y-0 border-0"
              >
                Send Reset Link
              </Button>
            </form>
          </>
        ) : (
          /* ── Success State ── */
          <div className="space-y-5 py-2">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1.5">Check your inbox</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                If that email address is registered in our system, a password reset link has been sent.
                The link expires in <strong className="text-slate-300">1 hour</strong>.
              </p>
            </div>

            {/* Dev-mode reset link (only shown if server returned it) */}
            {devResetLink && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Development Mode — Reset Link
                </div>
                <p className="text-xs text-slate-400">
                  Email sending is disabled in dev. Click the link below to reset the password:
                </p>
                <a
                  href={devResetLink}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 break-all transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="underline underline-offset-2 break-all">{devResetLink}</span>
                </a>
              </div>
            )}

            <div className="pt-1">
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
