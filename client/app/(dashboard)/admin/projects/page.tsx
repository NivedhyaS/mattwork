'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import Label from '@/components/ui/label';
import Modal from '@/components/ui/modal';
import Drawer from '@/components/ui/drawer';
import {
  Plus,
  Search,
  Kanban as KanbanIcon,
  Table as TableIcon,
  Calendar,
  User,
  Paperclip,
  CheckCircle,
  FileText,
  DollarSign,
  Briefcase,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { formatDate, getStatusBadgeClass, getPriorityBadgeClass, formatCurrency } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define the 9 workflow stages
const KANBAN_STAGES = [
  { id: 'PENDING', label: 'New Video' },
  { id: 'IN_PROGRESS', label: 'Editing' },
  { id: 'REVIEW', label: 'Editing Review' },
  { id: 'REVISION', label: 'Revision 1' },
  { id: 'REVISION_1_REVIEW', label: 'Revision 1 Review' },
  { id: 'REVISION_2', label: 'Revision 2' },
  { id: 'REVISION_2_REVIEW', label: 'Revision 2 Review' },
  { id: 'FINAL_DRAFT', label: 'Final Draft' },
  { id: 'COMPLETED', label: 'Uploaded' },
];

const createProjectSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional(),
  clientId: z.string().min(1, 'Client is required'),
  editorId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().optional().nullable(),
  budget: z.coerce.number().positive().optional().nullable(),
  tags: z.string().optional(), // We'll split tags by comma
  notes: z.string().optional(),
  driveFolder: z.string().optional(),
  formLink: z.string().url().or(z.literal('')).optional(),
});

type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Queries
  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects?limit=100');
      return res.data;
    },
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients?limit=100');
      return res.data;
    },
  });

  const { data: editorsData } = useQuery({
    queryKey: ['editors'],
    queryFn: async () => {
      const res = await api.get('/editors?limit=100');
      return res.data;
    },
  });

  const { data: selectedProjectData } = useQuery({
    queryKey: ['project', selectedProjectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProjectId}`);
      return res.data.data;
    },
    enabled: !!selectedProjectId,
  });

  const projects = projectsData?.data || [];
  const clients = clientsData?.data || [];
  const editors = editorsData?.data || [];
  const projectDetail = selectedProjectData || null;

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // Map frontend stages back to DB enums if needed
      // Our backend uses: PENDING, IN_PROGRESS, REVIEW, REVISION, COMPLETED, CANCELLED, ON_HOLD
      // Let's normalize frontend KANBAN_STAGES back to backend enums safely
      let apiStatus = status;
      if (status === 'REVISION_1_REVIEW' || status === 'REVISION_2_REVIEW') apiStatus = 'REVIEW';
      if (status === 'REVISION_2') apiStatus = 'REVISION';
      if (status === 'FINAL_DRAFT') apiStatus = 'IN_PROGRESS';

      await api.patch(`/projects/${id}/status`, { status: apiStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('/projects', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateOpen(false);
      reset();
    },
  });

  // Create Project Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: '',
      description: '',
      clientId: '',
      editorId: '',
      priority: 'MEDIUM' as any,
      dueDate: '',
      budget: 0,
      tags: '',
      notes: '',
      driveFolder: '',
      formLink: '',
    },
  });

  const onCreateSubmit = (values: CreateProjectFormValues) => {
    const formattedData = {
      ...values,
      tags: values.tags ? values.tags.split(',').map((t) => t.trim()) : [],
      editorId: values.editorId || null,
      formLink: values.formLink || undefined,
    };
    createProjectMutation.mutate(formattedData);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    updateStatusMutation.mutate({ id, status });
  };

  // Filter projects
  const filteredProjects = projects.filter((project: any) => {
    const matchesSearch =
      project.title.toLowerCase().includes(search.toLowerCase()) ||
      project.client?.company?.toLowerCase().includes(search.toLowerCase()) ||
      project.client?.user?.name?.toLowerCase().includes(search.toLowerCase());

    const matchesPriority = priorityFilter === 'ALL' || project.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  // Group by Kanban stage
  const getProjectsByStage = (stageId: string) => {
    return filteredProjects.filter((p: any) => {
      // Map backend status PENDING, IN_PROGRESS, REVIEW, REVISION, COMPLETED to columns
      if (stageId === 'PENDING') return p.status === 'PENDING';
      if (stageId === 'IN_PROGRESS') return p.status === 'IN_PROGRESS';
      if (stageId === 'REVIEW') return p.status === 'REVIEW';
      if (stageId === 'REVISION') return p.status === 'REVISION';
      if (stageId === 'COMPLETED') return p.status === 'COMPLETED';
      // Rest are fallback matches to keep board neat
      return false;
    });
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8.5rem)] overflow-hidden">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Project Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage files, video revisions, deadlines, and editing queues.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggles */}
          <div className="flex border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-white dark:bg-slate-950">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'kanban'
                  ? 'bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-white'
                  : 'text-slate-400 hover:text-slate-700'
                }`}
            >
              <KanbanIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === 'table'
                  ? 'bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-white'
                  : 'text-slate-400 hover:text-slate-700'
                }`}
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>

          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 cursor-pointer font-semibold">
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-850 rounded-xl flex-shrink-0">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by title, client, company..."
            className="pl-9 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-10"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'kanban' ? (
          // Kanban Grid
          <div className="flex gap-4 overflow-x-auto pb-4 h-full scrollbar-thin select-none">
            {KANBAN_STAGES.map((stage) => {
              // Group items (We distribute our backend statuses onto the visual 9 stages cleanly)
              const stageProjects = filteredProjects.filter((p: any) => {
                if (stage.id === 'PENDING') return p.status === 'PENDING';
                if (stage.id === 'IN_PROGRESS') return p.status === 'IN_PROGRESS';
                if (stage.id === 'REVIEW') return p.status === 'REVIEW';
                if (stage.id === 'REVISION') return p.status === 'REVISION';
                if (stage.id === 'COMPLETED') return p.status === 'COMPLETED';
                return false; // Leave sub-review columns empty on initial mock fallback
              });

              return (
                <div
                  key={stage.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                  className="w-80 flex-shrink-0 flex flex-col bg-slate-100/50 dark:bg-slate-900/30 rounded-xl p-3 border border-slate-200/50 dark:border-slate-900/50 h-full"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="font-bold text-sm tracking-tight text-slate-800 dark:text-slate-100">
                      {stage.label}
                    </span>
                    <Badge variant="secondary" className="h-5 text-[10px] px-2 font-bold">
                      {stageProjects.length}
                    </Badge>
                  </div>

                  {/* Cards container */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
                    {stageProjects.map((project: any) => (
                      <div
                        key={project.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project.id)}
                        onClick={() => setSelectedProjectId(project.id)}
                        className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing hover:border-slate-350 dark:hover:border-slate-750 transition-all duration-150"
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="text-[9px] text-slate-400 font-mono tracking-wider">
                            #{project.id.slice(-6).toUpperCase()}
                          </span>
                          <Badge className="text-[9px] scale-90" style={{
                            backgroundColor: project.priority === 'URGENT' ? '#ffe4e6' : project.priority === 'HIGH' ? '#ffedd5' : '#dbeafe',
                            color: project.priority === 'URGENT' ? '#991b1b' : project.priority === 'HIGH' ? '#9a3412' : '#1e40af'
                          }}>
                            {project.priority}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-sm leading-snug tracking-tight mb-2 truncate">
                          {project.title}
                        </h4>

                        <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                          {project.client?.company && (
                            <div className="flex items-center gap-1.5">
                              <Briefcase className="h-3.5 w-3.5" />
                              <span className="truncate">{project.client.company}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {project.editor?.user?.name || 'Unassigned'}
                            </span>
                          </div>
                          {project.dueDate && (
                            <div className="flex items-center gap-1.5 text-rose-500">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{formatDate(project.dueDate)}</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar Mock */}
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-900">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                            <span>Revisions</span>
                            <span>45%</span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-500 rounded-full" style={{ width: '45%' }} />
                          </div>
                        </div>
                      </div>
                    ))}

                    {stageProjects.length === 0 && (
                      <div className="h-28 border-2 border-dashed border-slate-200 dark:border-slate-900 rounded-xl flex items-center justify-center text-slate-400 text-xs font-semibold select-none">
                        Drop here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Data Table View
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-bold uppercase tracking-wider text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-6 py-4">Project ID</th>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Assigned Editor</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Budget</th>
                    <th className="px-6 py-4">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium">
                  {filteredProjects.map((project: any) => (
                    <tr
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs">
                        #{project.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">
                        {project.title}
                      </td>
                      <td className="px-6 py-4">
                        {project.client?.company || project.client?.user?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {project.editor?.user?.name || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={project.priority === 'URGENT' ? 'danger' : project.priority === 'HIGH' ? 'warning' : 'default'}>
                          {project.priority}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={project.status === 'COMPLETED' ? 'success' : 'secondary'}>
                          {project.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(project.budget)}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatDate(project.dueDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      <Drawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Project"
        description="Add a new project to the pipeline."
      >
        <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="title">Project Video Title</Label>
              <Input id="title" placeholder="" error={errors.title?.message} {...register('title')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clientId">Client</Label>
              <Select id="clientId" error={errors.clientId?.message} {...register('clientId')}>
                <option value="">Select a Client</option>
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.company ? `${c.company} (${c.user.name})` : c.user.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editorId">Assign Editor (Optional)</Label>
              <Select id="editorId" error={errors.editorId?.message} {...register('editorId')}>
                <option value="">Keep Unassigned</option>
                {editors.map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {e.user.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" {...register('priority')}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget">Allocated Budget ($)</Label>
              <Input id="budget" type="number" step="0.01" error={errors.budget?.message} {...register('budget')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags (Comma-separated)</Label>
              <Input id="tags" placeholder="commercial, promo, color-grade" {...register('tags')} />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="driveFolder">Google Drive Folder Link</Label>
              <Input id="driveFolder" placeholder="https://drive.google.com/..." {...register('driveFolder')} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-900 mt-6">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" isLoading={createProjectMutation.isPending} className="cursor-pointer font-bold">
              Create Project
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Details Side Drawer */}
      <Drawer
        isOpen={!!selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
        title={projectDetail ? projectDetail.title : 'Project Details'}
        size="lg"
      >
        {projectDetail ? (
          <div className="space-y-6 select-none">
            {/* Metadata Summary */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-150 dark:border-slate-850 rounded-xl text-xs font-semibold">
              <div className="space-y-1">
                <span className="text-slate-400 uppercase tracking-wider text-[9px]">Client Profile</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {projectDetail.client?.company || projectDetail.client?.user?.name}
                </p>
                <p className="text-slate-400 font-medium">{projectDetail.client?.user?.email}</p>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 uppercase tracking-wider text-[9px]">Assigned Editor</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {projectDetail.editor?.user?.name || 'Unassigned'}
                </p>
                <p className="text-slate-400 font-medium">
                  {projectDetail.editor?.user?.email || 'N/A'}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Description</h4>
              <p className="text-sm text-slate-500 leading-relaxed bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-900">
                {projectDetail.description || 'No description provided.'}
              </p>
            </div>

            {/* Files Panel Mock */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Project Files</h4>
                <Button variant="outline" size="sm" className="h-8 text-[11px] gap-1 cursor-pointer">
                  <Plus className="h-3.5 w-3.5" /> Upload File
                </Button>
              </div>

              <div className="space-y-2">
                {projectDetail.files?.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-900 rounded-lg text-xs text-slate-400">
                    No files uploaded yet.
                  </div>
                ) : (
                  projectDetail.files?.map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-900 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4.5 w-4.5 text-sky-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-250">{file.originalName}</p>
                          <p className="text-[10px] text-slate-400 font-medium">Version {file.version}</p>
                        </div>
                      </div>
                      <a href={file.url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-slate-600">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Invoices panel */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Project Invoices</h4>

              <div className="space-y-2">
                {projectDetail.invoices?.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-900 rounded-lg text-xs text-slate-400">
                    No invoices generated yet.
                  </div>
                ) : (
                  projectDetail.invoices?.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-900 rounded-lg">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        <div>
                          <p className="text-xs font-bold">{inv.number}</p>
                          <p className="text-[10px] text-slate-400">Due {formatDate(inv.dueDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">{formatCurrency(inv.total)}</p>
                        <Badge className="text-[9px] py-0 px-1.5 mt-0.5 scale-90" variant={inv.status === 'PAID' ? 'success' : 'secondary'}>
                          {inv.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 animate-pulse text-slate-400" />
          </div>
        )}
      </Drawer>
    </div>
  );
}
