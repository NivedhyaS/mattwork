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

  // Drawers state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

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
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white">
            Client Management
          </h1>
          <p className="text-[15px] text-slate-500 dark:text-slate-400 mt-1">
            Manage clients, view their projects, and track balances
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="self-start sm:self-auto cursor-pointer">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : error ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-rose-500" />
            </div>
            <div>
              <p className="font-bold text-[16px] text-rose-600 dark:text-rose-400">Failed to load clients</p>
              <p className="text-[14px] text-slate-400 mt-1">
                {(error as any)?.response?.data?.message || (error as any)?.message || 'Could not reach the server.'}
              </p>
            </div>
            <button onClick={() => refetch()} className="flex items-center gap-2 text-[14px] font-semibold border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Briefcase className="h-10 w-10 mx-auto mb-3 text-slate-200 dark:text-slate-800" />
            <p className="font-semibold text-[15px]">No clients found</p>
            <p className="text-[13px] mt-1">Add a client or try a different search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-900 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-5">Client</th>
                  <th className="py-4 px-5">Company</th>
                  <th className="py-4 px-5">Location</th>
                  <th className="py-4 px-5">Budget</th>
                  <th className="py-4 px-5">Joined</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors group">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center font-bold text-indigo-600 text-[15px] shrink-0">
                          {client.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[15px] text-slate-900 dark:text-white">{client.user.name}</p>
                          <p className="text-[13px] text-slate-400">{client.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-[14px] text-slate-600 dark:text-slate-300 font-medium">
                      {client.company || <span className="text-slate-300 dark:text-slate-700 italic text-[13px]">Not set</span>}
                    </td>
                    <td className="py-4 px-5 text-[14px] text-slate-500">
                      {[client.city, client.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="py-4 px-5">
                      {client.advancePaid != null && client.advancePaid > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold text-[13px]">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(client.advancePaid, client.currency || 'USD')}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700 italic text-[13px]">Not set</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-[14px] text-slate-500">
                      {new Date(client.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditDrawer(client)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/admin/projects?clientId=${client.id}`}
                          title="View projects"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${client.user.name}? This cannot be undone.`)) {
                              deleteMutation.mutate(client.id);
                            }
                          }}
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
      <p className="text-[13px] text-slate-400 text-right">{clients.length} clients shown</p>

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
                {...createForm.register('advancePaid')}
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
                {...editForm.register('advancePaid')}
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
    </div>
  );
}
