'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import Button from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { KeyRound, Mail, User, AlertCircle } from 'lucide-react';
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
        err.response?.data?.message || 'Registration failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-xl">
        {/* Brand/Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xl shadow-lg mb-4">
            MW
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            Create an account
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Join the Mattwork Post-Production Platform
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 p-3.5 border border-rose-100 dark:border-rose-950/50 text-rose-600 dark:text-rose-450 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-4 w-4" />
              </span>
              <Input
                id="name"
                placeholder=""
                className="pl-9"
                error={errors.name?.message}
                {...register('name')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-4 w-4" />
              </span>
              <Input
                id="email"
                type="email"
                placeholder=""
                className="pl-9"
                error={errors.email?.message}
                {...register('email')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <KeyRound className="h-4 w-4" />
              </span>
              <Input
                id="password"
                type="password"
                placeholder=""
                className="pl-9"
                error={errors.password?.message}
                {...register('password')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">I want to register as a</Label>
            <Select id="role" error={errors.role?.message} {...register('role')}>
              <option value="CLIENT">Client</option>
              <option value="EDITOR">Editor</option>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full font-bold shadow-md cursor-pointer mt-2"
            isLoading={isLoading}
          >
            Create Account
          </Button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-bold text-slate-800 dark:text-slate-200 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
