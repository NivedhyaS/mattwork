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
import { KeyRound, Mail, User, AlertCircle, Eye, EyeOff, Briefcase } from 'lucide-react';
import Link from 'next/link';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['CLIENT', 'EDITOR']).default('CLIENT'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'CLIENT',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/register', values);
      const { user, tokens } = response.data.data;

      login(user, tokens.accessToken, tokens.refreshToken);

      if (user.role === 'ADMIN') {
        window.location.href = '/admin';
      } else if (user.role === 'EDITOR') {
        window.location.href = '/editor';
      } else if (user.role === 'CLIENT') {
        window.location.href = '/client';
      } else {
        window.location.href = '/unauthorized';
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Registration failed. Please try again.'
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
        .animate-register-card {
          animation: fadeInSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Register Card */}
      <div className="max-w-[450px] w-full bg-slate-900/40 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-[0_0_50px_-12px_rgba(0,0,0,0.6)] animate-register-card z-10 hover:border-white/10 transition-all duration-300">
        {/* Brand/Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2 bg-gradient-to-b from-white to-slate-350 bg-clip-text">
            Create an Account
          </h2>
          <p className="text-sm text-slate-400 font-medium">
            Join the Mattwork Post-Production Platform
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Full Name
            </Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <User className="h-4.5 w-4.5" />
              </span>
              <input
                id="name"
                type="text"
                autoComplete="name"
                {...register('name')}
                className={`w-full h-12 pl-11 pr-4 rounded-xl bg-slate-950/40 border text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-slate-950/80 transition-all duration-200 ${
                  errors.name ? 'border-rose-500/50 focus:border-rose-500' : 'border-slate-800/80 hover:border-slate-700/80 focus:border-blue-500/60'
                }`}
                aria-invalid={errors.name ? 'true' : 'false'}
              />
            </div>
            {errors.name && (
              <p className="text-xs text-rose-500 font-medium mt-1 pl-1">{errors.name.message}</p>
            )}
          </div>

          {/* Email Field */}
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
                aria-invalid={errors.email ? 'true' : 'false'}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-rose-500 font-medium mt-1 pl-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <KeyRound className="h-4.5 w-4.5" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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

          {/* Role Field */}
          <div className="space-y-2">
            <Label htmlFor="role" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              I want to register as a
            </Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 pointer-events-none">
                <Briefcase className="h-4.5 w-4.5" />
              </span>
              <select
                id="role"
                {...register('role')}
                className={`w-full h-12 pl-11 pr-4 rounded-xl bg-slate-950/40 border text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-slate-950/80 transition-all duration-200 border-slate-800/80 hover:border-slate-700/80 focus:border-blue-500/60 cursor-pointer appearance-none`}
              >
                <option value="CLIENT" className="bg-slate-900 text-white">Client</option>
                <option value="EDITOR" className="bg-slate-900 text-white">Editor</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-500">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
            {errors.role && (
              <p className="text-xs text-rose-500 font-medium mt-1 pl-1">{errors.role.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-255 shadow-[0_4px_20px_-2px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_25px_0px_rgba(59,130,246,0.45)] hover:-translate-y-[1px] active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer mt-6 border-0"
            isLoading={isLoading}
          >
            Create Account
          </Button>
        </form>

        <div className="text-center mt-8">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-blue-400 hover:text-blue-300 transition-colors underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
