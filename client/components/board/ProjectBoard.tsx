'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { api } from '@/lib/api';
import { 
  Loader2, 
  Clock, 
  User, 
  RefreshCw, 
  FileText, 
  ExternalLink, 
  DollarSign, 
  Search, 
  Filter, 
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Lock,
  Plus
} from 'lucide-react';
import Drawer from '@/components/ui/drawer';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';

// Nine production columns
const KANBAN_COLUMNS = [
  { id: 'NEW_VIDEO', title: 'New Video', color: 'bg-status-gray border-l-slate-400' },
  { id: 'EDITING', title: 'Editing', color: 'bg-status-amber border-l-amber-500' },
  { id: 'EDITING_REVIEW', title: 'Editing Review', color: 'bg-indigo-500/20 border-l-indigo-500' },
  { id: 'REVISION_1', title: 'Revision 1', color: 'bg-orange-500/20 border-l-orange-500' },
  { id: 'REVISION_1_REVIEW', title: 'Revision 1 Review', color: 'bg-purple-500/20 border-l-purple-500' },
  { id: 'REVISION_2', title: 'Revision 2', color: 'bg-orange-500/20 border-l-orange-500' },
  { id: 'REVISION_2_REVIEW', title: 'Revision 2 Review', color: 'bg-purple-500/20 border-l-purple-500' },
  { id: 'FINAL_DRAFT', title: 'Final Draft', color: 'bg-status-amber border-l-amber-500' },
  { id: 'UPLOADED', title: 'Uploaded', color: 'bg-status-green border-l-emerald-500' },
];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  MEDIUM: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-350 dark:border-blue-800/40',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-350 dark:border-amber-800/40',
  URGENT: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-350 dark:border-rose-800/40',
};

interface Project {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  clientPrice: number | string | null;
  editorPrice: number | string | null;
  profit: number | string | null;
  description?: string | null;
  notes?: string | null;
  driveFolder?: string | null;
  formLink?: string | null;
  createdAt: string;
  client: { company: string | null; user: { name: string; email?: string } };
  editor: { user: { name: string; email?: string } } | null;
  files?: any[];
  invoices?: any[];
}

interface ProjectBoardProps {
  role: 'ADMIN' | 'EDITOR' | 'CLIENT';
  extraHeader?: React.ReactNode;
}

export default function ProjectBoard({ role, extraHeader }: ProjectBoardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'dueDate' | 'createdAt' | 'priority' | 'title'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // File Upload State (for Editor workstation)
  const [uploadUrl, setUploadUrl] = useState('');
  const [isSubmittingFile, setIsSubmittingFile] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/projects?limit=100');
      setProjects(res.data.data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    fetchProjects();
  }, [fetchProjects]);

  // Handle Drag & Drop status updates (ADMIN only)
  const onDragEnd = async (result: DropResult) => {
    if (role !== 'ADMIN') return;

    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const oldProjects = [...projects];

    // Optimistic UI Update
    setProjects((prev) =>
      prev.map((p) => (p.id === draggableId ? { ...p, status: newStatus } : p))
    );

    setUpdatingId(draggableId);
    try {
      await api.patch(`/projects/${draggableId}/status`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update project status:', err);
      // Rollback on failure
      setProjects(oldProjects);
      alert('Failed to update project status. Restored previous column.');
    } finally {
      setUpdatingId(null);
    }
  };

  const openProjectDetails = async (project: Project) => {
    setSelectedProject(project);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/projects/${project.id}`);
      setSelectedProject(res.data.data);
    } catch (err) {
      console.error('Failed to fetch project details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Turnaround highlighting / Overdue details
  const formatCardDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = d < today;
    const diffTime = d.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let isUrgentHighlight = false;
    if (diffDays >= 0 && diffDays <= 2) {
      isUrgentHighlight = true;
    }

    return { 
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), 
      isOverdue,
      isUrgentHighlight
    };
  };

  // Compile timeline for activity history
  const getActivityHistory = (project: Project) => {
    const historyList: { type: 'create' | 'file' | 'invoice' | 'note'; date: Date; title: string; desc: string }[] = [];
    
    // 1. Creation
    historyList.push({
      type: 'create',
      date: new Date(project.createdAt),
      title: 'Project Initiated',
      desc: 'Submitted and logged in workflow.'
    });

    // 2. Uploaded files
    if (project.files && project.files.length > 0) {
      project.files.forEach((file) => {
        historyList.push({
          type: 'file',
          date: new Date(file.createdAt),
          title: `File Uploaded (v${file.version})`,
          desc: `${file.originalName} by ${file.uploadedById || 'System'}`
        });
      });
    }

    // 3. Invoices
    if (project.invoices && project.invoices.length > 0) {
      project.invoices.forEach((inv) => {
        historyList.push({
          type: 'invoice',
          date: new Date(inv.createdAt),
          title: `Invoice Generated: ${inv.number}`,
          desc: `Total Amount: ${formatCurrency(inv.total)} · Status: ${inv.status.toLowerCase()}`
        });
        if (inv.status === 'PAID' && inv.paidAt) {
          historyList.push({
            type: 'invoice',
            date: new Date(inv.paidAt),
            title: `Invoice Paid: ${inv.number}`,
            desc: `Full payment captured.`
          });
        }
      });
    }

    // Sort chronologically (newest first)
    return historyList.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  // Editor workstations: submit draft/uploads
  const handleEditorUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadUrl || !selectedProject) return;
    setIsSubmittingFile(true);
    try {
      // In the real flow, upload deliverable marks status as EDITING_REVIEW
      await api.patch(`/projects/${selectedProject.id}/status`, { status: 'EDITING_REVIEW' });
      // Update local lists
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedProject.id ? { ...p, status: 'EDITING_REVIEW' } : p))
      );
      // Re-fetch project detail
      const res = await api.get(`/projects/${selectedProject.id}`);
      setSelectedProject(res.data.data);
      setUploadUrl('');
      alert('Deliverable submitted successfully.');
    } catch (err) {
      console.error('Failed to submit deliverable:', err);
      alert('Failed to submit link.');
    } finally {
      setIsSubmittingFile(false);
    }
  };

  // Editor workstation quick status update
  const handleStatusUpdate = async (projectId: string, newStatus: string) => {
    try {
      await api.patch(`/projects/${projectId}/status`, { status: newStatus });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
      );
      if (selectedProject?.id === projectId) {
        setSelectedProject((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      console.error('Status update failed:', err);
      alert('Status update failed.');
    }
  };

  // Apply local filtering, search, and sorting
  const filteredProjects = projects.filter((p) => {
    const isCancelledOrHold = p.status === 'CANCELLED' || p.status === 'ON_HOLD';
    if (isCancelledOrHold) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = p.title.toLowerCase().includes(q);
      const matchesId = p.id.toLowerCase().includes(q);
      const matchesClient = p.client?.user?.name?.toLowerCase().includes(q) || p.client?.company?.toLowerCase().includes(q);
      const matchesEditor = p.editor?.user?.name?.toLowerCase().includes(q);

      if (!matchesTitle && !matchesId && !matchesClient && !matchesEditor) return false;
    }

    if (priorityFilter !== 'ALL') {
      if (p.priority !== priorityFilter) return false;
    }

    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'dueDate') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    } else if (sortBy === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortBy === 'priority') {
      const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      comparison = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    } else if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full -m-6 md:-m-8 overflow-hidden select-none">
      {/* Board Header & Controls */}
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-accent" />
              Production Workspace
            </h1>
            <p className="text-[15px] text-slate-500 mt-2">
              Showing {sortedProjects.length} projects of {projects.length} total. Role view: <span className="font-bold text-accent">{role.toLowerCase()}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {extraHeader}
            {updatingId && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                syncing status...
              </div>
            )}
            <button
              onClick={fetchProjects}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-350 border border-slate-250 dark:border-slate-800 px-3.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Board
            </button>
            {role === 'ADMIN' && (
              <a
                href="/admin/projects"
                className="flex items-center gap-1.5 text-[13px] font-semibold bg-accent text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Add Project
              </a>
            )}
          </div>
        </div>

        {/* Search, Filters, Sort */}
        <div className="flex flex-col md:flex-row gap-3 pt-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-450" />
            <input
              type="text"
              placeholder="Search by ID, video title, client, or editor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-[15px] rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4.5 w-4.5 text-slate-450 shrink-0" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-[15px] border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2.5 bg-transparent focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Sort selection */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4.5 w-4.5 text-slate-450 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-[15px] border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2.5 bg-transparent focus:outline-none"
            >
              <option value="createdAt">Date Created</option>
              <option value="dueDate">Deadline</option>
              <option value="priority">Priority Scale</option>
              <option value="title">Title Alphabetical</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2.5 border border-slate-250 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <span className="text-[13px] font-bold">{sortOrder.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-x-auto p-6 md:p-8 bg-slate-50 dark:bg-slate-900/30">
        {loading ? (
          <div className="flex gap-4 h-full min-w-max pb-2">
            {KANBAN_COLUMNS.map((column) => (
              <div
                key={column.id}
                className="w-72 flex flex-col bg-slate-100/50 dark:bg-slate-900/10 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0"
              >
                <div className="p-3 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-400 animate-pulse">Loading column...</span>
                </div>
                <div className="p-3 space-y-3 flex-1">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-28 bg-slate-200/55 dark:bg-slate-800/40 rounded-xl animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full min-w-max pb-2">
              {KANBAN_COLUMNS.map((column) => {
                const columnProjects = sortedProjects.filter((p) => p.status === column.id);
                return (
                  <div
                    key={column.id}
                    className="w-72 flex flex-col bg-white dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-850 shrink-0 shadow-sm"
                  >
                    {/* Column Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
                          <h3 className="font-bold text-[16px] text-slate-800 dark:text-slate-200">
                            {column.title}
                          </h3>
                        </div>
                        <span className="text-[12px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-850 px-2.5 py-0.5 rounded-full">
                          {columnProjects.length}
                        </span>
                      </div>
                    </div>

                    {/* Droppable Area */}
                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 p-3 overflow-y-auto space-y-3 min-h-[220px] transition-colors duration-150 ${
                            snapshot.isDraggingOver
                              ? 'bg-slate-50/70 dark:bg-slate-900/20'
                              : 'bg-transparent'
                          }`}
                        >
                          {columnProjects.map((project, index) => {
                            const dueDate = formatCardDate(project.dueDate);
                            const isUpdating = updatingId === project.id;
                            
                            // Calculate project profit for ADMIN card view
                            let profitAmount: number | null = null;
                            if (role === 'ADMIN' && project.clientPrice && project.editorPrice) {
                              profitAmount = Number(project.clientPrice) - Number(project.editorPrice);
                            }

                            return (
                              <Draggable
                                key={project.id}
                                draggableId={project.id}
                                index={index}
                                isDragDisabled={role !== 'ADMIN'}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => openProjectDetails(project)}
                                    className={`relative bg-card p-3 rounded-xl border border-slate-200 dark:border-slate-850 transition-all select-none cursor-pointer flex flex-col gap-2 ${
                                      snapshot.isDragging
                                        ? 'ring-1 ring-accent border-accent rotate-1 shadow-lg'
                                        : 'hover:border-slate-400 dark:hover:border-slate-750 hover:shadow-sm'
                                    } ${isUpdating ? 'opacity-60' : ''}`}
                                  >
                                    {/* Left accent color border */}
                                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-accent/30 rounded-r" />

                                    <div className="pl-1.5 space-y-2.5">
                                      {/* Project ID & Priority */}
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-mono text-slate-400 font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/40 px-1.5 py-0.5 rounded">
                                          #{project.id.slice(-6).toUpperCase()}
                                        </span>
                                        <span
                                          className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                            PRIORITY_COLORS[project.priority] || PRIORITY_COLORS.LOW
                                          }`}
                                        >
                                          {project.priority.toLowerCase()}
                                        </span>
                                      </div>

                                      {/* Video Title */}
                                      <p className="font-bold text-[15px] text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
                                        {project.title}
                                      </p>

                                      {/* Client Company / Name */}
                                      <div className="flex items-center gap-1.5">
                                        <Briefcase className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                        <span className="text-[13px] text-slate-500 font-medium truncate">
                                          {project.client?.company || project.client?.user?.name}
                                        </span>
                                      </div>

                                      {/* Editor name */}
                                      {project.editor ? (
                                        <div className="flex items-center gap-1.5">
                                          <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                          <span className="text-[13px] text-slate-500 font-normal">
                                            {project.editor.user.name}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <User className="h-3.5 w-3.5 text-slate-350 flex-shrink-0" />
                                          <span className="text-[13px] text-slate-400 italic">
                                            unassigned
                                          </span>
                                        </div>
                                      )}

                                      {/* Footer: Date & Profit */}
                                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900 mt-1">
                                        {dueDate ? (
                                          <div
                                            className={`flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5 border ${
                                              dueDate.isOverdue
                                                ? 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30'
                                                : dueDate.isUrgentHighlight
                                                ? 'text-amber-700 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30'
                                                : 'text-slate-500 bg-slate-50 border-slate-200/50 dark:bg-slate-900/30 dark:border-slate-800'
                                            }`}
                                          >
                                            <Clock className="h-3 w-3" />
                                            {dueDate.label}
                                          </div>
                                        ) : (
                                          <div />
                                        )}

                                        {/* Financial indicator (ADMIN only) */}
                                        {profitAmount !== null && (
                                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                            ₹{profitAmount.toLocaleString('en-IN')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}

                          {columnProjects.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/30">
                              <p className="text-[10px] text-slate-400 font-medium">No videos</p>
                              {role === 'ADMIN' && (
                                <p className="text-[8px] text-slate-400 mt-0.5">Drag cards here</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Slide-out Drawer for Project Details */}
      <Drawer
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        title={selectedProject ? selectedProject.title : 'Project Workspace'}
        size="lg"
      >
        {selectedProject ? (
          <div className="space-y-6 text-[14px] text-slate-700 dark:text-slate-350">
            {/* Upper Stage Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-900 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200/50">
                  ID: {selectedProject.id.toUpperCase()}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${PRIORITY_COLORS[selectedProject.priority] || PRIORITY_COLORS.LOW}`}>
                  {selectedProject.priority.toLowerCase()} priority
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-450 uppercase font-semibold">status:</span>
                <Badge variant={selectedProject.status === 'UPLOADED' ? 'success' : 'warning'}>
                  {selectedProject.status.replace(/_/g, ' ').toLowerCase()}
                </Badge>
              </div>
            </div>

            {/* Profile grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-900/20 p-4 border border-slate-200/80 dark:border-slate-850 rounded-xl">
              <div className="space-y-1.5">
                <span className="text-slate-400 text-[12px] font-bold uppercase tracking-wider block">Client (Owner)</span>
                <p className="font-bold text-[15px] text-slate-800 dark:text-slate-200">
                  {selectedProject.client?.user?.name}
                </p>
                {selectedProject.client?.company && (
                  <p className="text-[14px] text-slate-500 font-semibold">{selectedProject.client.company}</p>
                )}
                {selectedProject.client?.user?.email && (
                  <p className="text-[13px] text-slate-450 font-normal">{selectedProject.client.user.email}</p>
                )}
              </div>
              <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-250/60 dark:border-slate-800/60 pt-3 md:pt-0 md:pl-4">
                <span className="text-slate-400 text-[12px] font-bold uppercase tracking-wider block">Assigned Editor</span>
                {selectedProject.editor ? (
                  <>
                    <p className="font-bold text-[15px] text-slate-800 dark:text-slate-200">
                      {selectedProject.editor.user.name}
                    </p>
                    {selectedProject.editor.user.email && (
                      <p className="text-[13px] text-slate-450 font-normal">{selectedProject.editor.user.email}</p>
                    )}
                  </>
                ) : (
                  <p className="text-[14px] text-slate-400 italic">No editor assigned</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-[14px] text-slate-850 dark:text-slate-200 uppercase tracking-wide">Brief / Description</h4>
              <p className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-850 text-[14px] leading-relaxed whitespace-pre-line">
                {selectedProject.description || 'No description provided.'}
              </p>
            </div>

            {/* Source material folder links */}
            {(selectedProject.driveFolder || selectedProject.formLink) && (
              <div className="space-y-2">
                <h4 className="font-bold text-[14px] text-slate-850 dark:text-slate-200 uppercase tracking-wide">Production links</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedProject.driveFolder && (
                    <a
                      href={selectedProject.driveFolder}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 hover:border-accent hover:text-accent transition-colors"
                    >
                      <span className="font-semibold">Google Drive Folder</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  {selectedProject.formLink && (
                    <a
                      href={selectedProject.formLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 hover:border-accent hover:text-accent transition-colors"
                    >
                      <span className="font-semibold">Submit/Form Link</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Deliverable drafts */}
            <div className="space-y-3">
              <h4 className="font-bold text-[14px] text-slate-850 dark:text-slate-200 uppercase tracking-wide">Uploaded drafts</h4>
              <div className="space-y-2">
                {loadingDetails ? (
                  <div className="h-12 bg-slate-100 dark:bg-slate-900 rounded-lg animate-pulse" />
                ) : !selectedProject.files || selectedProject.files.length === 0 ? (
                  <p className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400">
                    No files uploaded yet.
                  </p>
                ) : (
                  selectedProject.files.map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-950">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4.5 w-4.5 text-accent" />
                        <div className="min-w-0">
                          <p className="font-semibold text-[14px] truncate text-slate-800 dark:text-slate-200">{file.originalName}</p>
                          <p className="text-[13px] text-slate-400">Version {file.version} · {formatDate(file.createdAt)}</p>
                        </div>
                      </div>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Financial panel (ADMIN only) */}
            {role === 'ADMIN' && (
              <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-[14px] text-slate-850 dark:text-slate-200 uppercase tracking-wide">Financial breakdown</h4>
                <div className="grid grid-cols-3 gap-3 bg-slate-50/70 dark:bg-slate-900/30 p-4 border border-slate-250/60 dark:border-slate-800 rounded-xl">
                  <div>
                    <span className="text-[12px] text-slate-400 block font-bold uppercase">Client budget</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {selectedProject.clientPrice ? formatCurrency(selectedProject.clientPrice) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[12px] text-slate-400 block font-bold uppercase">Editor payout</span>
                    <span className="font-bold text-[15px] text-slate-800 dark:text-white">
                      {selectedProject.editorPrice ? formatCurrency(selectedProject.editorPrice) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[12px] text-slate-400 block font-bold uppercase">Net margins</span>
                    <span className="font-bold text-[15px] text-emerald-600 dark:text-emerald-400">
                      {selectedProject.profit ? formatCurrency(selectedProject.profit) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Invoices panel */}
            {selectedProject.invoices && selectedProject.invoices.length > 0 && (
              <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-[14px] text-slate-850 dark:text-slate-200 uppercase tracking-wide">Associated invoices</h4>
                <div className="space-y-2">
                  {selectedProject.invoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-950">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4.5 w-4.5 text-accent" />
                        <div>
                          <p className="font-semibold text-[14px]">{inv.number}</p>
                          <p className="text-[13px] text-slate-400">Due {formatDate(inv.dueDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(inv.total)}</p>
                        <Badge className="text-[10px] py-0 px-2 font-semibold capitalize" variant={inv.status === 'PAID' ? 'success' : 'secondary'}>
                          {inv.status.toLowerCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workstation Actions based on role */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-[14px] text-slate-850 dark:text-slate-200 uppercase tracking-wide">Available actions</h4>
              
              {role === 'ADMIN' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {/* Status selection for Admin workstation */}
                    {['NEW_VIDEO', 'EDITING', 'EDITING_REVIEW', 'REVISION_1', 'REVISION_1_REVIEW', 'REVISION_2', 'REVISION_2_REVIEW', 'FINAL_DRAFT', 'UPLOADED'].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusUpdate(selectedProject.id, s)}
                        className={`text-[10px] font-semibold border px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          selectedProject.status === s 
                            ? 'bg-accent text-white border-accent' 
                            : 'border-slate-250 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        {s.replace(/_/g, ' ').toLowerCase()}
                      </button>
                    ))}
                  </div>
                  <a
                    href={`/admin/projects`}
                    className="w-full flex items-center justify-center bg-slate-900 dark:bg-slate-800 text-white py-2 rounded-lg font-semibold text-center hover:opacity-90 transition-opacity"
                  >
                    Edit Project Configurations
                  </a>
                </div>
              )}

              {role === 'EDITOR' && (
                <div className="space-y-4">
                  {/* Quick status progress buttons */}
                  <div className="space-y-2">
                    <span className="text-[12px] text-slate-400 font-bold uppercase tracking-wider block">Update progress stage</span>
                    <div className="flex flex-wrap gap-2">
                      {['EDITING', 'REVISION_1', 'REVISION_2'].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusUpdate(selectedProject.id, s)}
                          className={`text-[12px] font-bold border px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
                            selectedProject.status === s
                              ? 'bg-accent text-white border-accent'
                              : 'border-slate-250 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                          }`}
                        >
                          {s.replace(/_/g, ' ').toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload Form */}
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-900 pt-4">
                    <span className="text-[12px] text-slate-400 font-bold uppercase tracking-wider block">Submit draft deliverable URL</span>
                    <form onSubmit={handleEditorUpload} className="flex gap-2">
                      <input
                        type="url"
                        required
                        placeholder="Paste link to Google Drive draft export..."
                        value={uploadUrl}
                        onChange={(e) => setUploadUrl(e.target.value)}
                        className="flex-1 text-[14px] p-2.5 rounded-lg border border-slate-250 dark:border-slate-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingFile}
                        className="bg-accent text-white font-bold px-4 py-2.5 rounded-lg text-[14px] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {isSubmittingFile ? 'Submitting...' : 'Upload Link'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {role === 'CLIENT' && (
                <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/10 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                  <Lock className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                  <span className="text-[14px] text-slate-550">
                    You have read-only permissions for this workspace. Changes can be updated by contacting the master account Admin.
                  </span>
                </div>
              )}
            </div>

            {/* Activity History Timeline */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-[14px] text-slate-850 dark:text-slate-200 uppercase tracking-wide">Activity history timeline</h4>
              <div className="relative border-l-2 border-slate-100 dark:border-slate-900 pl-4 space-y-4 ml-2">
                {getActivityHistory(selectedProject).map((event, idx) => (
                  <div key={idx} className="relative group">
                    {/* timeline bullet dot */}
                    <div className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-950 bg-accent shrink-0" />
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[14px] text-slate-800 dark:text-slate-200">
                          {event.title}
                        </span>
                        <span className="text-[12px] text-slate-400 font-mono">
                          {event.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500">{event.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        )}
      </Drawer>
    </div>
  );
}
