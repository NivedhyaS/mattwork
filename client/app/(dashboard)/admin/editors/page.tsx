'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Trash2, UserPlus, Star, Search, Loader2, Edit2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/button';
import Drawer from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import Label from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';

interface Editor {
  id: string;
  bio?: string | null;
  skills: string[];
  hourlyRate?: number | null;
  availability: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

const editorSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  bio: z.string().optional(),
  skills: z.string().optional(), // We'll parse this into array later
  hourlyRate: z.string().optional(),
  availability: z.boolean().default(true),
});

type EditorFormValues = z.infer<typeof editorSchema>;

export default function EditorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Drawers state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editEditor, setEditEditor] = useState<Editor | null>(null);

  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['editors'],
    queryFn: async () => {
      const res = await api.get('/editors?limit=100');
      return res.data;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/editors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editors'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('/editors', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editors'] });
      setIsCreateOpen(false);
      createForm.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      await api.patch(`/editors/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editors'] });
      setEditEditor(null);
      editForm.reset();
    },
  });

  // Forms
  const createForm = useForm({
    resolver: zodResolver(editorSchema),
    defaultValues: { name: '', email: '', password: '', bio: '', skills: '', hourlyRate: '', availability: true },
  });

  const editForm = useForm({
    resolver: zodResolver(editorSchema),
    defaultValues: { name: '', email: '', password: '', bio: '', skills: '', hourlyRate: '', availability: true },
  });

  const onCreateSubmit = (values: EditorFormValues) => {
    const payload = {
      ...values,
      skills: values.skills ? values.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      hourlyRate: values.hourlyRate ? parseFloat(values.hourlyRate) : undefined,
    };
    createMutation.mutate(payload);
  };

  const onEditSubmit = (values: EditorFormValues) => {
    if (!editEditor) return;
    const payload: any = {
      name: values.name,
      email: values.email,
      bio: values.bio,
      availability: values.availability,
      skills: values.skills ? values.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      hourlyRate: values.hourlyRate ? parseFloat(values.hourlyRate) : undefined,
    };
    if (values.password) {
      payload.password = values.password;
    }
    updateMutation.mutate({ id: editEditor.id, data: payload });
  };

  const openEditDrawer = (editor: Editor) => {
    setEditEditor(editor);
    editForm.reset({
      name: editor.user.name,
      email: editor.user.email,
      password: '',
      bio: editor.bio || '',
      skills: editor.skills?.join(', ') || '',
      hourlyRate: editor.hourlyRate?.toString() || '',
      availability: editor.availability,
    });
  };

  const editors: Editor[] = (data?.data || []).filter((e: Editor) =>
    !search ||
    e.user.name.toLowerCase().includes(search.toLowerCase()) ||
    e.user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white">
            Editor Management
          </h1>
          <p className="text-[15px] text-slate-500 dark:text-slate-400 mt-1">
            Manage your editing team, rates, and availability
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="self-start sm:self-auto cursor-pointer">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Editor
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search editors by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Cards or Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm text-center py-20 flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-rose-500" />
          </div>
          <div>
            <p className="font-bold text-[16px] text-rose-600 dark:text-rose-400">Failed to load editors</p>
            <p className="text-[14px] text-slate-400 mt-1">
              {(error as any)?.response?.data?.message || (error as any)?.message || 'Could not reach the server.'}
            </p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 text-[14px] font-semibold border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : editors.length === 0 ? (
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm text-center py-16 text-slate-400">
          <Star className="h-10 w-10 mx-auto mb-3 text-slate-200 dark:text-slate-800" />
          <p className="font-semibold text-[15px]">No editors found</p>
          <p className="text-[13px] mt-1">Add your first editor to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {editors.map((editor) => (
            <div
              key={editor.id}
              className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-900 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-800 transition-all"
            >
              {/* Avatar + Name */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center font-bold text-indigo-600 text-lg shrink-0">
                    {editor.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-[15px] text-slate-900 dark:text-white">{editor.user.name}</p>
                    <p className="text-[13px] text-slate-400 truncate max-w-[140px]">{editor.user.email}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[12px] font-bold border shrink-0 ${editor.availability
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900'
                    : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                  }`}>
                  {editor.availability ? 'Available' : 'Busy'}
                </span>
              </div>

              {/* Bio */}
              {editor.bio && (
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-3 line-clamp-2">{editor.bio}</p>
              )}

              {/* Skills */}
              {editor.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {editor.skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="text-[12px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full">
                      {skill}
                    </span>
                  ))}
                  {editor.skills.length > 4 && (
                    <span className="text-[12px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
                      +{editor.skills.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-900">
                <div>
                  {editor.hourlyRate ? (
                    <p className="text-[15px] font-bold text-slate-900 dark:text-white">
                      ${Number(editor.hourlyRate).toLocaleString('en-US')}
                      <span className="text-[13px] font-medium text-slate-400 ml-1">/ video</span>
                    </p>
                  ) : (
                    <p className="text-[13px] text-slate-400 italic">No rate set</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditDrawer(editor)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${editor.user.name}? This cannot be undone.`)) {
                        deleteMutation.mutate(editor.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[13px] text-slate-400 text-right">{editors.length} editors shown</p>

      {/* Create Editor Drawer */}
      <Drawer
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          createForm.reset();
        }}
        title="Create New Editor"
        description="Add a new editor profile to the platform."
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

            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 mt-6">Editor Profile</h3>
            <div className="space-y-2">
              <Label>Bio (Optional)</Label>
              <Input {...createForm.register('bio')} placeholder="Short bio about the editor" />
            </div>
            <div className="space-y-2">
              <Label>Skills (Comma separated)</Label>
              <Input {...createForm.register('skills')} placeholder="Premiere Pro, After Effects, Color Grading" />
            </div>
            <div className="space-y-2">
              <Label>Rate per video (Optional)</Label>
              <Input {...createForm.register('hourlyRate')} type="number" placeholder="" />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="create-avail" {...createForm.register('availability')} className="rounded text-indigo-600" />
              <Label htmlFor="create-avail" className="mb-0">Currently Available</Label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create Editor</Button>
          </div>
        </form>
      </Drawer>

      {/* Edit Editor Drawer */}
      <Drawer
        isOpen={!!editEditor}
        onClose={() => setEditEditor(null)}
        title="Edit Editor"
        description="Update editor details and profile."
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

            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 mt-6">Editor Profile</h3>
            <div className="space-y-2">
              <Label>Bio (Optional)</Label>
              <Input {...editForm.register('bio')} placeholder="Short bio about the editor" />
            </div>
            <div className="space-y-2">
              <Label>Skills (Comma separated)</Label>
              <Input {...editForm.register('skills')} placeholder="" />
            </div>
            <div className="space-y-2">
              <Label>Rate per video (Optional)</Label>
              <Input {...editForm.register('hourlyRate')} type="number" placeholder="" />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="edit-avail" {...editForm.register('availability')} className="rounded text-indigo-600" />
              <Label htmlFor="edit-avail" className="mb-0">Currently Available</Label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setEditEditor(null)}>Cancel</Button>
            <Button type="submit" isLoading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
