'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import Button from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', values);
      const { user, tokens } = response.data.data;

      login(user, tokens.accessToken, tokens.refreshToken);

      if (user.role === 'ADMIN') {
        router.replace('/admin');
      } else if (user.role === 'EDITOR') {
        router.replace('/editor');
      } else if (user.role === 'CLIENT') {
        router.replace('/client');
      } else {
        router.replace('/unauthorized');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Login failed. Please check your credentials.'
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

      {/* Entrance Animation Styles */}
      <style>{`
        @keyframes fadeInSlideUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-login-card {
          animation: fadeInSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Login Card */}
      <div className="max-w-[450px] w-full bg-slate-900/40 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-[0_0_50px_-12px_rgba(0,0,0,0.6)] animate-login-card z-10 hover:border-white/10 transition-all duration-300">
        {/* Brand/Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2 bg-gradient-to-b from-white to-slate-350 bg-clip-text">
            Sign In to Mattwork
          </h2>
          <p className="text-sm text-slate-400 font-medium">
            Welcome back! Please sign in to continue.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 p-3.5 border border-rose-500/20 text-rose-450 text-xs font-semibold mb-6 animate-pulse">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Email Address
            </Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Mail className="h-4.5 w-4.5" />
              </span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className={`w-full h-12 pl-11 pr-4 rounded-xl bg-slate-950/40 border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-slate-950/80 transition-all duration-200 ${
                  errors.email ? 'border-rose-500/50 focus:border-rose-500' : 'border-slate-800/80 hover:border-slate-700/80 focus:border-blue-500/60'
                }`}
                placeholder="name@company.com"
                aria-invalid={errors.email ? 'true' : 'false'}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-rose-500 font-medium mt-1 pl-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </Label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Please contact your administrator to reset your password.');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
              >
                Forgot Password?
              </a>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <KeyRound className="h-4.5 w-4.5" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                className={`w-full h-12 pl-11 pr-11 rounded-xl bg-slate-950/40 border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-slate-950/80 transition-all duration-200 ${
                  errors.password ? 'border-rose-500/50 focus:border-rose-500' : 'border-slate-800/80 hover:border-slate-700/80 focus:border-blue-500/60'
                }`}
                placeholder="••••••••"
                aria-invalid={errors.password ? 'true' : 'false'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-350 focus:outline-none cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-rose-500 font-medium mt-1 pl-1">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-255 shadow-[0_4px_20px_-2px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_25px_0px_rgba(59,130,246,0.45)] hover:-translate-y-[1px] active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer mt-6 border-0"
            isLoading={isLoading}
          >
            Sign In
          </Button>
        </form>

        <div className="text-center mt-8">
          <p className="text-xs text-slate-400">
            Need an account?{' '}
            <Link
              href="/register"
              className="font-semibold text-blue-400 hover:text-blue-300 transition-colors underline-offset-4 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
