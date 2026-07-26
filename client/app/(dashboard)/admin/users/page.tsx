'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Trash2, UserPlus, Shield, Edit2, Loader2, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import Label from '@/components/ui/label';
import Select from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Toast from '@/components/ui/Toast';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  avatar?: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-[#F6EFE9] text-[#EA580C] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold px-3 py-1 rounded-xl',
  EDITOR: 'bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold px-3 py-1 rounded-xl',
  CLIENT: 'bg-[#F6EFE9] text-[#10B981] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold px-3 py-1 rounded-xl',
};

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['ADMIN', 'EDITOR', 'CLIENT']),
});

const editUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .optional()
    .or(z.literal('')),
  role: z.enum(['ADMIN', 'EDITOR', 'CLIENT']),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type EditUserFormValues = z.infer<typeof editUserSchema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users?limit=100');
      return res.data;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/users/${id}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserFormValues) => {
      setCreateError(null);
      await api.post('/auth/register', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: (err: any) => {
      setCreateError(
        err.response?.data?.message || err.message || 'Failed to create user'
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<EditUserFormValues> }) => {
      setUpdateError(null);
      await api.patch(`/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
      editForm.reset();
    },
    onError: (err: any) => {
      setUpdateError(
        err.response?.data?.message || err.message || 'Failed to update user'
      );
    },
  });

  // Forms
  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: '', email: '', password: '', role: 'CLIENT' },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { name: '', email: '', password: '', role: 'CLIENT' },
  });

  const onCreateSubmit = (values: CreateUserFormValues) => {
    createMutation.mutate(values);
  };

  const onEditSubmit = async (values: EditUserFormValues) => {
    if (!editUser) return;
    const updateData: Partial<EditUserFormValues> = { name: values.name, email: values.email, role: values.role };
    
    try {
      setUpdateError(null);
      // Update basic details
      await api.patch(`/users/${editUser.id}`, updateData);
      
      // If a new password was provided, forcefully reset it
      if (values.password) {
        await api.post(`/users/${editUser.id}/admin-password-reset`, { newPassword: values.password });
      }

      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
      editForm.reset();
    } catch (err: any) {
      setUpdateError(
        err.response?.data?.message || err.message || 'Failed to update user'
      );
    }
  };

  const openEditModal = (user: User) => {
    setUpdateError(null);
    setEditUser(user);
    editForm.reset({
      name: user.name,
      email: user.email,
      role: user.role as any,
      password: '',
    });
  };

  const users: User[] = (data?.data || []).filter((u: User) =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-tight text-[#3D2E24]">
            User Management
          </h1>
          <p className="text-[15px] text-[#7C6A5A] mt-1 font-extrabold">
            Manage all platform users — Admins, Editors, and Clients
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="self-start sm:self-auto cursor-pointer rounded-2xl font-extrabold">
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7769]" />
        <input
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] font-semibold shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none focus:shadow-[inset_5px_5px_10px_rgba(206,187,172,0.7),inset_-5px_-5px_10px_rgba(255,255,255,0.9)] transition-all text-[15px]"
        />
      </div>

      {/* Table Card */}
      <div className="bg-[#F6EFE9] rounded-3xl border-0 shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] overflow-hidden p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" />
          </div>
        ) : error ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(239,68,68,0.3)] flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-[#EF4444]" />
            </div>
            <div>
              <p className="font-extrabold text-[16px] text-[#EF4444]">Failed to load users</p>
              <p className="text-[14px] text-[#7C6A5A] mt-1">
                {(error as any)?.response?.data?.message ||
                  (error as any)?.message ||
                  'Could not reach the server. Make sure the backend is running.'}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 text-[14px] font-extrabold px-4 py-2 rounded-2xl bg-[#F6EFE9] text-[#3D2E24] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 text-[#EA580C]" />
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-[#8C7769]">
            <Shield className="h-10 w-10 mx-auto mb-3 text-[#EA580C]" />
            <p className="font-extrabold">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-[#F6EFE9] border-b border-[rgba(206,187,172,0.3)] text-xs font-extrabold uppercase tracking-wider text-[#8C7769]">
                  <th className="py-3.5 px-5">User</th>
                  <th className="py-3.5 px-5">Role</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Joined</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(206,187,172,0.2)]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[rgba(234,88,12,0.04)] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-white shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[user.role] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <button
                        onClick={() => toggleMutation.mutate(user.id)}
                        disabled={toggleMutation.isPending}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 ${user.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900'
                          : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                          }`}
                        title="Click to toggle status"
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteUserTarget(user)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 text-right">{users.length} users shown</p>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateError(null);
          createForm.reset();
        }}
        title="Create New User"
        description="Add a new admin, editor, or client to the platform."
      >
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 py-4">
          {createError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 p-3.5 border border-rose-100 dark:border-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-500" />
              <span>{createError}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input {...createForm.register('name')} placeholder="" />
            {createForm.formState.errors.name && (
              <p className="text-xs text-rose-500">{createForm.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input {...createForm.register('email')} type="email" placeholder="" />
            {createForm.formState.errors.email && (
              <p className="text-xs text-rose-500">{createForm.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input {...createForm.register('password')} type="password" placeholder="At least 8 chars, uppercase, lowercase, number" />
            {createForm.formState.errors.password && (
              <p className="text-xs text-rose-500">{createForm.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select {...createForm.register('role')}>
              <option value="CLIENT">Client</option>
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Admin</option>
            </Select>
            {createForm.formState.errors.role && (
              <p className="text-xs text-rose-500">{createForm.formState.errors.role.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create User</Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editUser}
        onClose={() => {
          setEditUser(null);
          setUpdateError(null);
        }}
        title="Edit User"
        description="Update user details and role."
      >
        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
          {updateError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 p-3.5 border border-rose-100 dark:border-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-500" />
              <span>{updateError}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input {...editForm.register('name')} placeholder="" />
            {editForm.formState.errors.name && (
              <p className="text-xs text-rose-500">{editForm.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input {...editForm.register('email')} type="email" placeholder="" />
            {editForm.formState.errors.email && (
              <p className="text-xs text-rose-500">{editForm.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>New Password (Optional)</Label>
            <Input {...editForm.register('password')} type="password" placeholder="Leave blank to keep current" />
            {editForm.formState.errors.password && (
              <p className="text-xs text-rose-500">{editForm.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select {...editForm.register('role')}>
              <option value="CLIENT">Client</option>
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Admin</option>
            </Select>
            {editForm.formState.errors.role && (
              <p className="text-xs text-rose-500">{editForm.formState.errors.role.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button type="submit" isLoading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Delete User Modal */}
      <ConfirmModal
        isOpen={!!deleteUserTarget}
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={async () => {
          if (!deleteUserTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteUserTarget.id);
            setToast({ message: `User "${deleteUserTarget.name}" deleted.`, type: 'success' });
          } catch {
            setToast({ message: 'Failed to delete user.', type: 'error' });
          } finally {
            setDeleteUserTarget(null);
          }
        }}
        title="Delete User?"
        description={`Are you sure you want to delete ${deleteUserTarget?.name}? This action cannot be undone.`}
        confirmText="Delete User"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
