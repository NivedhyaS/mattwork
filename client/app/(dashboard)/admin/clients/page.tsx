'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Trash2, UserPlus, Briefcase, Search, Loader2, ExternalLink, Edit2, RefreshCw, AlertTriangle, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';
import Button from '@/components/ui/button';
import Drawer from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import Label from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Toast from '@/components/ui/Toast';

interface Client {
  id: string;
  company?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  currency?: string | null;
  advancePaid?: number | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatar?: string | null;
  };
  _count?: { projects: number; invoices: number };
}

const clientSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  company: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().length(3, 'Must be a 3-letter currency code'),
  advancePaid: z.number().min(0, 'Must be a positive number').optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Drawers & Toast state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClientTarget, setDeleteClientTarget] = useState<Client | null>(null);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients?limit=100');
      return res.data;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      await api.post('/clients', data); // Uses backend createClient endpoint
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsCreateOpen(false);
      createForm.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<ClientFormValues> }) => {
      await api.patch(`/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditClient(null);
      editForm.reset();
    },
  });

  // Forms
  const createForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', email: '', password: '', company: '', phone: '', city: '', country: '', notes: '', currency: 'USD', advancePaid: 0 },
  });

  const editForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', email: '', password: '', company: '', phone: '', city: '', country: '', notes: '', currency: 'USD', advancePaid: 0 },
  });

  const onCreateSubmit = (values: ClientFormValues) => {
    createMutation.mutate(values);
  };

  const onEditSubmit = (values: ClientFormValues) => {
    if (!editClient) return;
    const updateData: Partial<ClientFormValues> = {
      name: values.name,
      email: values.email,
      company: values.company,
      phone: values.phone,
      city: values.city,
      country: values.country,
      notes: values.notes,
      currency: values.currency,
      advancePaid: values.advancePaid,
    };
    if (values.password) {
      updateData.password = values.password;
    }
    updateMutation.mutate({ id: editClient.id, data: updateData });
  };

  const openEditDrawer = (client: Client) => {
    setEditClient(client);
    editForm.reset({
      name: client.user.name,
      email: client.user.email,
      password: '',
      company: client.company || '',
      phone: client.user.phone || '',
      city: client.city || '',
      country: client.country || '',
      notes: client.notes || '',
      currency: client.currency || 'USD',
      advancePaid: client.advancePaid ?? 0,
    });
  };

  const clients: Client[] = (data?.data || []).filter((c: Client) =>
    !search ||
    c.user.name.toLowerCase().includes(search.toLowerCase()) ||
    c.user.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-tight text-[#1F1610]">
            Client Management
          </h1>
          <p className="text-[15px] text-[#4A3E34] mt-1 font-extrabold">
            Manage clients, view their projects, and track balances
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="self-start sm:self-auto cursor-pointer rounded-2xl font-extrabold">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A3E34]" />
        <input
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-0 bg-[#D8CFC2] text-[#1F1610] font-semibold shadow-[inset_4px_4px_8px_rgba(135,120,108,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none focus:shadow-[inset_5px_5px_10px_rgba(135,120,108,0.7),inset_-5px_-5px_10px_rgba(255,255,255,0.9)] transition-all text-[15px]"
        />
      </div>

      {/* Table Card */}
      <div className="bg-[#D8CFC2] rounded-3xl border-0 shadow-[inset_3px_3px_6px_rgba(135,120,108,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] overflow-hidden p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" />
          </div>
        ) : error ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#D8CFC2] shadow-[inset_3px_3px_6px_rgba(239,68,68,0.3)] flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-[#EF4444]" />
            </div>
            <div>
              <p className="font-extrabold text-[16px] text-[#EF4444]">Failed to load clients</p>
              <p className="text-[14px] text-[#4A3E34] mt-1">
                {(error as any)?.response?.data?.message || (error as any)?.message || 'Could not reach the server.'}
              </p>
            </div>
            <button onClick={() => refetch()} className="flex items-center gap-2 text-[14px] font-extrabold px-4 py-2 rounded-2xl bg-[#D8CFC2] text-[#1F1610] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(135,120,108,0.6)] cursor-pointer">
              <RefreshCw className="h-4 w-4 text-[#EA580C]" />
              Retry
            </button>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 text-[#4A3E34]">
            <Briefcase className="h-10 w-10 mx-auto mb-3 text-[#EA580C]" />
            <p className="font-extrabold text-[15px]">No clients found</p>
            <p className="text-[13px] mt-1">Add a client or try a different search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-[#D8CFC2] border-b border-[rgba(135,120,108,0.3)] text-xs font-extrabold uppercase tracking-wider text-[#4A3E34]">
                  <th className="py-3.5 px-5">Client</th>
                  <th className="py-3.5 px-5">Company</th>
                  <th className="py-3.5 px-5">Location</th>
                  <th className="py-3.5 px-5">Budget</th>
                  <th className="py-3.5 px-5">Joined</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(135,120,108,0.25)]">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-[rgba(255,255,255,0.35)] transition-all duration-150 group cursor-pointer">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#E2DACC] text-[#1F1610] font-extrabold shadow-[inset_2px_2px_4px_rgba(135,120,108,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.7)] flex items-center justify-center shrink-0">
                          {client.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-[14px] text-[#1F1610] group-hover:text-[#EA580C] transition-colors">{client.user.name}</p>
                          <p className="text-[12px] text-[#4A3E34] font-semibold">{client.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-[14px] text-[#1F1610] font-bold">
                      {client.company || <span className="text-[#4A3E34] italic text-[13px] font-normal">Not set</span>}
                    </td>
                    <td className="py-4 px-5 text-[14px] text-[#4A3E34] font-bold">
                      {[client.city, client.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="py-4 px-5">
                      {client.advancePaid != null && client.advancePaid > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[rgba(16,185,129,0.14)] text-[#10B981] border border-[rgba(16,185,129,0.4)] shadow-[inset_1.5px_1.5px_3px_rgba(16,185,129,0.25)] font-extrabold text-[12px]">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(client.advancePaid, client.currency || 'USD')}
                        </span>
                      ) : (
                        <span className="text-[#4A3E34] italic text-[13px] font-semibold">Not set</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-[13px] text-[#4A3E34] font-bold">
                      {new Date(client.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditDrawer(client)}
                          className="p-2 rounded-xl text-[#4A3E34] hover:text-[#EA580C] bg-[#D8CFC2] hover:bg-[#E2DACC] shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),2px_2px_5px_rgba(135,120,108,0.5)] transition-all cursor-pointer"
                          title="Edit Client"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`/admin/projects?clientId=${client.id}`}
                          title="View projects"
                          className="p-2 rounded-xl text-[#4A3E34] hover:text-[#EA580C] bg-[#D8CFC2] hover:bg-[#E2DACC] shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),2px_2px_5px_rgba(135,120,108,0.5)] transition-all"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeleteClientTarget(client)}
                          disabled={deleteMutation.isPending}
                          className="p-2 rounded-xl text-[#EF4444] hover:text-white bg-[#D8CFC2] hover:bg-[#EF4444] shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),2px_2px_5px_rgba(135,120,108,0.5)] transition-all cursor-pointer disabled:opacity-50"
                          title="Delete Client"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
      <p className="text-[13px] text-[#4A3E34] font-bold text-right">{clients.length} clients shown</p>

      {/* Create Client Drawer */}
      <Drawer
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          createForm.reset();
        }}
        title="Create New Client"
        description="Add a new client profile to the platform."
      >
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">User Details</h3>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input {...createForm.register('name')} placeholder="" />
              {createForm.formState.errors.name && <p className="text-xs text-rose-500">{createForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input {...createForm.register('email')} type="email" placeholder="" />
              {createForm.formState.errors.email && <p className="text-xs text-rose-500">{createForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input {...createForm.register('password')} type="password" placeholder="Min 6 characters" />
              {createForm.formState.errors.password && <p className="text-xs text-rose-500">{createForm.formState.errors.password.message}</p>}
            </div>

            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 mt-6">Client Profile</h3>
            <div className="space-y-2">
              <Label>Company (Optional)</Label>
              <Input {...createForm.register('company')} placeholder="" />
            </div>
            <div className="space-y-2">
              <Label>Phone (Optional)</Label>
              <Input {...createForm.register('phone')} placeholder="" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City (Optional)</Label>
                <Input {...createForm.register('city')} placeholder="" />
              </div>
              <div className="space-y-2">
                <Label>Country (Optional)</Label>
                <Input {...createForm.register('country')} placeholder="" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <select
                  {...createForm.register('currency')}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input {...createForm.register('notes')} placeholder="Any internal notes about the client" />
            </div>
            <div className="space-y-2">
              <Label>Client Budget <span className="text-slate-400 font-normal">(Total advance paid, in client currency)</span></Label>
              <Input
                {...createForm.register('advancePaid', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 500"
              />
              {createForm.formState.errors.advancePaid && <p className="text-xs text-rose-500">{createForm.formState.errors.advancePaid.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create Client</Button>
          </div>
        </form>
      </Drawer>

      {/* Edit Client Drawer */}
      <Drawer
        isOpen={!!editClient}
        onClose={() => setEditClient(null)}
        title="Edit Client"
        description="Update client details and profile."
      >
        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">User Details</h3>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input {...editForm.register('name')} placeholder="" />
              {editForm.formState.errors.name && <p className="text-xs text-rose-500">{editForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input {...editForm.register('email')} type="email" placeholder="" />
              {editForm.formState.errors.email && <p className="text-xs text-rose-500">{editForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>New Password (Optional)</Label>
              <Input {...editForm.register('password')} type="password" placeholder="Leave blank to keep current" />
              {editForm.formState.errors.password && <p className="text-xs text-rose-500">{editForm.formState.errors.password.message}</p>}
            </div>

            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 mt-6">Client Profile</h3>
            <div className="space-y-2">
              <Label>Company (Optional)</Label>
              <Input {...editForm.register('company')} placeholder="" />
            </div>
            <div className="space-y-2">
              <Label>Phone (Optional)</Label>
              <Input {...editForm.register('phone')} placeholder="" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City (Optional)</Label>
                <Input {...editForm.register('city')} placeholder="" />
              </div>
              <div className="space-y-2">
                <Label>Country (Optional)</Label>
                <Input {...editForm.register('country')} placeholder="" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <select
                  {...editForm.register('currency')}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input {...editForm.register('notes')} placeholder="Any internal notes about the client" />
            </div>
            <div className="space-y-2">
              <Label>Client Budget <span className="text-slate-400 font-normal">(Total advance paid, in client currency)</span></Label>
              <Input
                {...editForm.register('advancePaid', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 500"
              />
              {editForm.formState.errors.advancePaid && <p className="text-xs text-rose-500">{editForm.formState.errors.advancePaid.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setEditClient(null)}>Cancel</Button>
            <Button type="submit" isLoading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Drawer>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Delete Client Modal */}
      <ConfirmModal
        isOpen={!!deleteClientTarget}
        onClose={() => setDeleteClientTarget(null)}
        onConfirm={async () => {
          if (!deleteClientTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteClientTarget.id);
            setToast({ message: `Client "${deleteClientTarget.user.name}" removed.`, type: 'success' });
          } catch {
            setToast({ message: 'Failed to remove client.', type: 'error' });
          } finally {
            setDeleteClientTarget(null);
          }
        }}
        title="Remove Client?"
        description={`Are you sure you want to remove ${deleteClientTarget?.user.name}? This cannot be undone.`}
        confirmText="Remove Client"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
