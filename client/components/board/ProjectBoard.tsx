'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  Loader2,
  Clock,
  User,
  RefreshCw,
  FileText,
  ExternalLink,
  DollarSign,
  MessageSquare,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Lock,
  Plus,
  Trash,
  Trash2,
  AlertTriangle,
  X,
  FilterX
} from 'lucide-react';
import Drawer from '@/components/ui/drawer';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import Select from '@/components/ui/select';
import PriorityCombobox from '@/components/ui/PriorityCombobox';
import ClientCombobox from '@/components/ui/ClientCombobox';
import { Input } from '@/components/ui/input';
import Label from '@/components/ui/label';
import EditorCombobox from '@/components/ui/EditorCombobox';
import RevisionRequestModal from './RevisionRequestModal';
import { formatCurrency, formatDate, formatEditorCurrency } from '@/lib/utils';
import { getCurrencySymbol } from '@/lib/currency';
import { useExchangeRate, buildProfitDisplay, formatFetchedAgo } from '@/lib/exchangeRate';
import { useQueryClient } from '@tanstack/react-query';

// Nine production columns
const KANBAN_COLUMNS = [
  { id: 'NEW_VIDEO', title: 'New Video', color: 'bg-status-gray border-l-slate-400' },
  { id: 'EDITING', title: 'Editing', color: 'bg-status-amber border-l-amber-500' },
  { id: 'EDITING_REVIEW', title: 'Editing Review', color: 'bg-indigo-500/20 border-l-indigo-500' },
  { id: 'REVISION_1', title: 'Revision 1', color: 'bg-orange-500/20 border-l-orange-500' },
  { id: 'REVISION_1_REVIEW', title: 'Revision 1 Review', color: 'bg-purple-500/20 border-l-purple-500' },
  { id: 'REVISION_2', title: 'Revision 2', color: 'bg-orange-500/20 border-l-orange-500' },
  { id: 'REVISION_2_REVIEW', title: 'Revision 2 Review', color: 'bg-purple-500/20 border-l-purple-500' },
  { id: 'REVISION_3', title: 'Revision 3', color: 'bg-orange-500/20 border-l-orange-500' },
  { id: 'REVISION_3_REVIEW', title: 'Revision 3 Review', color: 'bg-purple-500/20 border-l-purple-500' },
  { id: 'FINAL_DRAFT', title: 'Final Draft', color: 'bg-status-amber border-l-amber-500' },
  { id: 'UPLOADED', title: 'Uploaded', color: 'bg-status-green border-l-emerald-500' },
];

// ── Workflow permission helpers ────────────────────────────────────────────────

/** Returns the list of statuses an Editor is allowed to drag a card TO,
 *  given its current status. Empty array means the card is frozen (admin-only). */
function getEditorAllowedTargets(currentStatus: string): string[] {
  const ALLOWED: Record<string, string[]> = {
    NEW_VIDEO:  ['EDITING'],
    EDITING:    ['EDITING_REVIEW'],
    REVISION_1: ['REVISION_1_REVIEW'],
    REVISION_2: ['REVISION_2_REVIEW'],
    REVISION_3: ['REVISION_3_REVIEW'],
  };
  return ALLOWED[currentStatus] ?? [];
}

/** Returns true if an editor cannot pick up a card (it is frozen, waiting for Admin). */
function isFrozenStatus(status: string): boolean {
  return ['EDITING_REVIEW', 'REVISION_1_REVIEW', 'REVISION_2_REVIEW', 'REVISION_3_REVIEW', 'FINAL_DRAFT', 'UPLOADED'].includes(status);
}

/** Returns a small workflow badge config for the card footer. */
function getWorkflowBadge(project: Project): { label: string; classes: string } | null {
  const hasPendingAdmin = project.revisionRequests?.some(r => r.status === 'PENDING_ADMIN');
  if (hasPendingAdmin) {
    return { label: 'Pending Admin Review', classes: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-800/30' };
  }
  
  const hasNeedsClarification = project.revisionRequests?.some(r => r.status === 'NEEDS_CLARIFICATION');
  if (hasNeedsClarification) {
    return { label: 'Needs Clarification', classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800/30' };
  }

  switch (project.status) {
    case 'NEW_VIDEO':
      return null; // no badge needed
    case 'EDITING':
      return { label: 'Editing', classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800/30' };
    case 'EDITING_REVIEW':
    case 'REVISION_1_REVIEW':
    case 'REVISION_2_REVIEW':
    case 'REVISION_3_REVIEW':
      return { label: 'Waiting for Admin', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-800/30' };
    case 'REVISION_1':
    case 'REVISION_2':
    case 'REVISION_3':
      return { label: 'Revision Requested', classes: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-800/30' };
    case 'FINAL_DRAFT':
      return { label: 'Approved', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800/30' };
    case 'UPLOADED':
      return { label: 'Uploaded', classes: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
    default:
      return null;
  }
}

// ── Editor discussion tab helper functions ───────────────────────────────────

function getAvailableTabs(status: string, commentsList: any[]): string[] {
  const tabs = ['GENERAL'];
  const hasRevision1Comments = commentsList.some(c => c.content?.startsWith('[Revision 1] '));
  const hasRevision2Comments = commentsList.some(c => c.content?.startsWith('[Revision 2] '));
  const hasRevision3Comments = commentsList.some(c => c.content?.startsWith('[Revision 3] '));

  const isAtOrAfterRevision1 = [
    'REVISION_1',
    'REVISION_1_REVIEW',
    'REVISION_2',
    'REVISION_2_REVIEW',
    'REVISION_3',
    'REVISION_3_REVIEW',
    'FINAL_DRAFT',
    'UPLOADED'
  ].includes(status) || hasRevision1Comments;

  if (isAtOrAfterRevision1) {
    tabs.push('REVISION_1');
  }

  const isAtOrAfterRevision2 = [
    'REVISION_2',
    'REVISION_2_REVIEW',
    'REVISION_3',
    'REVISION_3_REVIEW',
    'FINAL_DRAFT',
    'UPLOADED'
  ].includes(status) || hasRevision2Comments;

  if (isAtOrAfterRevision2) {
    tabs.push('REVISION_2');
  }

  const enteredRevision3 = [
    'REVISION_3',
    'REVISION_3_REVIEW'
  ].includes(status) || hasRevision3Comments;

  if (enteredRevision3) {
    tabs.push('REVISION_3');
  }

  return tabs;
}

function getDefaultTab(status: string, commentsList: any[]): 'GENERAL' | 'REVISION_1' | 'REVISION_2' | 'REVISION_3' {
  const tabs = getAvailableTabs(status, commentsList);
  if (tabs.includes('REVISION_3') && ['REVISION_3', 'REVISION_3_REVIEW'].includes(status)) {
    return 'REVISION_3';
  }
  if (tabs.includes('REVISION_2') && ['REVISION_2', 'REVISION_2_REVIEW'].includes(status)) {
    return 'REVISION_2';
  }
  if (tabs.includes('REVISION_1') && ['REVISION_1', 'REVISION_1_REVIEW'].includes(status)) {
    return 'REVISION_1';
  }
  return 'GENERAL';
}

function cleanCommentContent(content: string): string {
  if (content?.startsWith('[Revision 1] ')) return content.slice('[Revision 1] '.length);
  if (content?.startsWith('[Revision 2] ')) return content.slice('[Revision 2] '.length);
  return content;
}

function getCommentCount(tab: string, commentsList: any[]): number {
  if (tab === 'GENERAL') {
    return commentsList.filter(c => !c.content?.startsWith('[Revision 1] ') && !c.content?.startsWith('[Revision 2] ')).length;
  }
  if (tab === 'REVISION_1') {
    return commentsList.filter(c => c.content?.startsWith('[Revision 1] ')).length;
}
  if (tab === 'REVISION_2') {
    return commentsList.filter(c => c.content?.startsWith('[Revision 2] ')).length;
  }
  return 0;
}

export const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: '🔴 High Priority', shortLabel: '🔴 HIGH', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-350 dark:border-amber-800/40', badgeColor: 'bg-slate-900 text-rose-400' },
  { value: 'MEDIUM', label: '🟡 Medium Priority', shortLabel: '🟡 MEDIUM', color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-350 dark:border-blue-800/40', badgeColor: 'bg-slate-900 text-amber-400' },
  { value: 'LOW', label: '🟢 Low Priority', shortLabel: '🟢 LOW', color: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', badgeColor: 'bg-slate-900 text-emerald-400' }
];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: PRIORITY_OPTIONS[2].color,
  MEDIUM: PRIORITY_OPTIONS[1].color,
  HIGH: PRIORITY_OPTIONS[0].color,
};

interface Project {
  id: string;
  title: string;
  status: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate: string | null;
  clientPrice: number | string | null;
  editorPrice: number | string | null;
  netMargin: number | string | null;
  description?: string | null;
  notes?: string | null;
  driveFolder?: string | null;
  formLink?: string | null;
  rawMaterialsFolder?: string | null;
  submissionDate?: string | null;
  clientId: string;
  editorId: string | null;
  createdAt: string;
  client: { id: string; company: string | null; currency?: string; user: { id: string; name: string; email?: string } };
  editor: { id: string; user: { id: string; name: string; email?: string } } | null;
  files?: any[];
  invoices?: any[];
  comments?: any[];
  revisionRequests?: any[];
  projectNumber?: string;
  standardName?: string;
  standardSlug?: string;
  hasPendingRevisionRequest?: boolean;
}

interface ProjectBoardProps {
  role: 'ADMIN' | 'EDITOR' | 'CLIENT';
  extraHeader?: React.ReactNode;
}

export default function ProjectBoard({ role, extraHeader }: ProjectBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { rate: exchangeRate } = useExchangeRate(role === 'ADMIN');
  const queryClient = useQueryClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeDragProject, setActiveDragProject] = useState<Project | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [revisionModalState, setRevisionModalState] = useState<{ isOpen: boolean; project: Project | null; targetStage: string }>({ isOpen: false, project: null, targetStage: '' });
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [sortBy, setSortBy] = useState<'dueDate' | 'createdAt' | 'title' | 'priority'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter Drawer State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({});

  // File Upload State (for Editor workstation)
  const [uploadUrl, setUploadUrl] = useState('');
  const [isSubmittingFile, setIsSubmittingFile] = useState(false);

  // States for Admin inline editing & Comments
  const [clients, setClients] = useState<any[]>([]);
  const [editors, setEditors] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSavingField, setIsSavingField] = useState<string | null>(null);
  const [rawMaterialsUrlInput, setRawMaterialsUrlInput] = useState('');
  const [isEditingRawMaterials, setIsEditingRawMaterials] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState<'GENERAL' | 'REVISION_1' | 'REVISION_2' | 'REVISION_3'>('GENERAL');

  // States for creating a project
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectClientId, setNewProjectClientId] = useState('');
  const [newProjectEditorId, setNewProjectEditorId] = useState('');
  const [newProjectDueDate, setNewProjectDueDate] = useState('');
  const [newProjectSubDate, setNewProjectSubDate] = useState('');
  const [newProjectClientPrice, setNewProjectClientPrice] = useState('500');
  const [newProjectEditorPrice, setNewProjectEditorPrice] = useState('200');
  const [newProjectRawMaterials, setNewProjectRawMaterials] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const resetCreateProjectForm = () => {
    setNewProjectTitle('');
    setNewProjectDesc('');
    setNewProjectClientId('');
    setNewProjectEditorId('');
    setNewProjectDueDate('');
    setNewProjectSubDate('');
    setNewProjectClientPrice('500');
    setNewProjectEditorPrice('200');
    setNewProjectRawMaterials('');
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) {
      alert('Project Title is required');
      return;
    }
    if (!newProjectClientId) {
      alert('Client Owner is required');
      return;
    }

    setIsCreatingProject(true);
    try {
      const payload: any = {
        title: newProjectTitle.trim(),
        description: newProjectDesc.trim() || undefined,
        clientId: newProjectClientId,
        editorId: newProjectEditorId || null,
        dueDate: newProjectDueDate ? new Date(newProjectDueDate).toISOString() : null,
        submissionDate: newProjectSubDate ? new Date(newProjectSubDate).toISOString() : null,
        clientPrice: newProjectClientPrice ? Number(newProjectClientPrice) : null,
        editorPrice: newProjectEditorPrice ? Number(newProjectEditorPrice) : null,
        rawMaterialsFolder: newProjectRawMaterials.trim() || null,
      };

      const res = await api.post('/projects', payload);
      const createdProject = res.data.data;

      // Add the new project to local state list
      setProjects((prev) => [createdProject, ...prev]);

      setIsCreateProjectOpen(false);
      resetCreateProjectForm();
      alert('Project created successfully.');
    } catch (err: any) {
      console.error('Failed to create project:', err);
      const errMsg = err?.response?.data?.message || 'Failed to create project.';
      alert(errMsg);
    } finally {
      setIsCreatingProject(false);
    }
  };


  const fetchMetadata = useCallback(async () => {
    if (role !== 'ADMIN') return;
    try {
      const [cRes, eRes] = await Promise.all([
        api.get('/clients?limit=100'),
        api.get('/editors?limit=100'),
      ]);
      setClients(cRes.data.data || []);
      setEditors(eRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch admin metadata:', err);
    }
  }, [role]);

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
    fetchMetadata();
  }, [fetchProjects, fetchMetadata]);

  // Auto-open project drawer when returning from a discussion page (?open=projectId)
  useEffect(() => {
    const openId = searchParams?.get('open');
    if (!openId || projects.length === 0) return;
    const target = projects.find((p) => p.id === openId || p.standardSlug === openId);
    if (target) {
      openProjectDetails(target);
      // Clean up the query param from the URL without a page reload
      const url = new URL(window.location.href);
      url.searchParams.delete('open');
      window.history.replaceState({}, '', url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, searchParams]);

  // Handle Drag & Drop status updates (ADMIN and EDITOR)
  const onDragStart = (start: any) => {
    const projectId = start.draggableId;
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setActiveDragProject(proj);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    setActiveDragProject(null);

    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;

    if (role === 'CLIENT') {
      const allowedRevisionStages = ['REVISION_1', 'REVISION_2', 'REVISION_3'];
      if (!allowedRevisionStages.includes(newStatus)) {
         return; 
      }
      const project = projects.find(p => p.id === draggableId);
      if (!project) return;
      setRevisionModalState({ isOpen: true, project, targetStage: newStatus });
      return;
    }

    if (role !== 'ADMIN' && role !== 'EDITOR') return;

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
    setRawMaterialsUrlInput(project.rawMaterialsFolder || '');
    setIsEditingRawMaterials(false);
    setComments([]);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/projects/${project.id}`);
      const data = res.data.data;
      setSelectedProject(data);
      setRawMaterialsUrlInput(data.rawMaterialsFolder || '');
      // Internal comments loading for ADMIN & EDITOR
      if (role === 'ADMIN' || role === 'EDITOR') {
        const cRes = await api.get(`/projects/${project.id}/comments`);
        const commentsList = cRes.data.data || [];
        setComments(commentsList);
        setActiveCommentTab(getDefaultTab(data.status, commentsList));
      }
    } catch (err) {
      console.error('Failed to fetch project details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Inline field updater for Admins
  const handleUpdateField = async (fieldName: string, value: any) => {
    if (!selectedProject || role !== 'ADMIN') return;
    setIsSavingField(fieldName);
    try {
      let payload: any = {};
      if (fieldName === 'editorId') {
        // Special endpoint for reassigning editor to trigger Drive/audit updates
        const res = await api.patch(`/projects/${selectedProject.id}/editor`, { editorId: value });
        const updatedProj = res.data.data;
        setSelectedProject(prev => prev ? { ...prev, editorId: value, editor: updatedProj.editor } : null);
        setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, editorId: value, editor: updatedProj.editor } : p));
      } else {
        payload[fieldName] = value === '' ? null : value;
        const res = await api.patch(`/projects/${selectedProject.id}`, payload);
        const updatedProj = res.data.data;
        // Keep nested Client name/identity if we edited clientId
        let updatedClient = selectedProject.client;
        if (fieldName === 'clientId') {
          const matchedClient = clients.find(c => c.id === value);
          if (matchedClient) {
            updatedClient = {
              id: matchedClient.id,
              company: matchedClient.company,
              user: {
                id: matchedClient.user.id,
                name: matchedClient.user.name,
                email: matchedClient.user.email,
              }
            } as any;
          }
        }
        setSelectedProject(prev => prev ? { ...prev, ...payload, client: updatedClient } : null);
        setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, ...payload, client: updatedClient } : p));
      }
    } catch (err) {
      console.error(`Failed to update ${fieldName}:`, err);
      alert(`Failed to update ${fieldName}.`);
    } finally {
      setIsSavingField(null);
    }
  };

  // Dedicated 1-click priority updater for Admins
  const handleUpdatePriority = async (projectId: string, priority: 'HIGH' | 'MEDIUM' | 'LOW', e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    if (role !== 'ADMIN') return;
    setIsSavingField(`priority_${projectId}`);
    try {
      await api.patch(`/projects/${projectId}/priority`, { priority });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, priority } : p))
      );
      if (selectedProject?.id === projectId) {
        setSelectedProject((prev) => (prev ? { ...prev, priority } : null));
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
      alert('Failed to update priority.');
    } finally {
      setIsSavingField(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (role !== 'ADMIN') return;
    if (!confirm('Are you sure you want to delete this project completely? This action is permanent.')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setSelectedProject(null);
      alert('Project deleted successfully.');
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Failed to delete project.');
    }
  };

  // Comments handlers
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedProject || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      let finalContent = newComment.trim();
      if (activeCommentTab === 'REVISION_1') {
        finalContent = `[Revision 1] ${finalContent}`;
      } else if (activeCommentTab === 'REVISION_2') {
        finalContent = `[Revision 2] ${finalContent}`;
      } else if (activeCommentTab === 'REVISION_3') {
        finalContent = `[Revision 3] ${finalContent}`;
      }

      const res = await api.post(`/projects/${selectedProject.id}/comments`, { content: finalContent });
      setComments(prev => [...prev, res.data.data]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
      alert('Failed to post comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedProject || role !== 'ADMIN') return;
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.delete(`/projects/${selectedProject.id}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Failed to delete comment.');
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
      alert('Review Folder submitted successfully.');
    } catch (err) {
      console.error('Failed to submit Review Folder:', err);
      alert('Failed to submit Review Folder.');
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
        if (newStatus === 'REVISION_1') {
          setActiveCommentTab('REVISION_1');
        } else if (newStatus === 'REVISION_2') {
          setActiveCommentTab('REVISION_2');
        } else if (newStatus === 'REVISION_3') {
          setActiveCommentTab('REVISION_3');
        }
      }
    } catch (err) {
      console.error('Status update failed:', err);
      alert('Status update failed.');
    }
  };


  // --- Active Filters parsing ---
  const activeFilters = {
    client: searchParams?.get('client') || '',
    editor: searchParams?.get('editor') || '',
    status: searchParams?.get('status') || '',
    priority: searchParams?.get('priority') || '',
    subFrom: searchParams?.get('subFrom') || '',
    subTo: searchParams?.get('subTo') || '',
    dueFrom: searchParams?.get('dueFrom') || '',
    dueTo: searchParams?.get('dueTo') || '',
    valMin: searchParams?.get('valMin') || '',
    valMax: searchParams?.get('valMax') || '',
    month: searchParams?.get('month') || '',
    overdue: searchParams?.get('overdue') === 'true',
    dueWeek: searchParams?.get('dueWeek') === 'true',
  };
  
  const activeFilterCount = Object.entries(activeFilters).filter(([k, v]) => {
    if (k === 'overdue' || k === 'dueWeek') return v === true;
    return v !== '';
  }).length;

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    Object.entries(filterDraft).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setIsFilterDrawerOpen(false);
  };

  const handleClearFilters = () => {
    router.replace(pathname, { scroll: false });
    setFilterDraft({});
    setIsFilterDrawerOpen(false);
  };

  // Extract dynamic options
  const uniqueStatuses = Array.from(new Set(projects.map(p => p.status)));

  // Apply local filtering, search, and sorting
  const filteredProjects = projects.filter((p) => {
    const isCancelledOrHold = p.status === 'CANCELLED' || p.status === 'ON_HOLD';
    if (isCancelledOrHold && activeFilters.status !== 'CANCELLED' && activeFilters.status !== 'ON_HOLD') {
        if (!activeFilters.status) return false;
    }

    if (role === 'ADMIN' && priorityFilter !== 'ALL') {
      const projPriority = p.priority || 'MEDIUM';
      if (projPriority !== priorityFilter) return false;
    }

    // --- Advanced Filters ---
    if (activeFilters.client && p.client?.id !== activeFilters.client) return false;
    if (role === 'ADMIN' && activeFilters.editor && p.editor?.id !== activeFilters.editor) return false;
    if (activeFilters.status && p.status !== activeFilters.status) return false;
    if (activeFilters.priority && (p.priority || 'MEDIUM') !== activeFilters.priority) return false;

    if (activeFilters.subFrom) {
      if (!p.submissionDate || new Date(p.submissionDate) < new Date(activeFilters.subFrom)) return false;
    }
    if (activeFilters.subTo) {
      if (!p.submissionDate || new Date(p.submissionDate) > new Date(activeFilters.subTo + 'T23:59:59')) return false;
    }

    if (activeFilters.dueFrom) {
      if (!p.dueDate || new Date(p.dueDate) < new Date(activeFilters.dueFrom)) return false;
    }
    if (activeFilters.dueTo) {
      if (!p.dueDate || new Date(p.dueDate) > new Date(activeFilters.dueTo + 'T23:59:59')) return false;
    }

    if (activeFilters.month) {
      if (!p.dueDate) return false;
      const d = new Date(p.dueDate);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthStr !== activeFilters.month) return false;
    }

    if (activeFilters.valMin || activeFilters.valMax) {
      const rawVal = Number(p.clientPrice || 0);
      const rate = Number(exchangeRate) || 1;
      const displayVal = rawVal / rate;
      if (activeFilters.valMin && displayVal < Number(activeFilters.valMin)) return false;
      if (activeFilters.valMax && displayVal > Number(activeFilters.valMax)) return false;
    }

    if (activeFilters.overdue) {
      if (!p.dueDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(p.dueDate) >= today) return false;
    }

    if (activeFilters.dueWeek) {
      if (!p.dueDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const d = new Date(p.dueDate);
      if (d < today || d > nextWeek) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = p.title.toLowerCase().includes(q);
      const matchesId = p.id.toLowerCase().includes(q);
      const matchesClient = p.client?.user?.name?.toLowerCase().includes(q) || p.client?.company?.toLowerCase().includes(q);
      const matchesEditor = p.editor?.user?.name?.toLowerCase().includes(q);
      const matchesStandardName = p.standardName?.toLowerCase().includes(q);

      if (!matchesTitle && !matchesId && !matchesClient && !matchesEditor && !matchesStandardName) return false;
    }

    return true;
  });

  const priorityRank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'priority') {
      const rankA = priorityRank[a.priority || 'MEDIUM'] || 2;
      const rankB = priorityRank[b.priority || 'MEDIUM'] || 2;
      comparison = rankA - rankB;
    } else if (sortBy === 'dueDate') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    } else if (sortBy === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full -m-6 md:-m-8 overflow-hidden select-none">
      {/* Board Header & Controls */}
      <div className="flex flex-col gap-4 bg-[#F6EFE9] p-6 md:p-8 shrink-0 border-b border-[rgba(206,187,172,0.3)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-[36px] font-extrabold tracking-tight text-[#3D2E24] leading-tight flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-[#EA580C] shrink-0" />
              {role === 'ADMIN' ? 'Production Workspace' : 'Mattwork Workspace'}
            </h1>
            <p className="text-[14px] text-[#7C6A5A] mt-2 font-extrabold">
              Showing {sortedProjects.length} projects of {projects.length} total. Role view: <span className="font-extrabold text-[#EA580C] uppercase tracking-wider">{role.toLowerCase()}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {extraHeader}
            {updatingId && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                syncing status...
              </div>
            )}
            <button
              onClick={fetchProjects}
              className="flex items-center gap-2 text-[13px] font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4.5 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 hover:border-slate-350 dark:hover:border-slate-700 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className="h-4 w-4 text-accent" />
              Reload Board
            </button>
            {role === 'ADMIN' && (
              <button
                onClick={() => setIsCreateProjectOpen(true)}
                className="flex items-center gap-2 text-[14px] font-extrabold bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white px-5 py-2.5 rounded-2xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.7),4px_4px_12px_rgba(234,88,12,0.4)] hover:shadow-[-6px_-6px_14px_rgba(255,255,255,0.8),6px_6px_16px_rgba(234,88,12,0.5)] transition-all cursor-pointer border-none"
              >
                <Plus className="h-4.5 w-4.5" />
                Add Project
              </button>
            )}
          </div>
        </div>

        {/* Search, Filters, Sort */}
        <div className="flex flex-col md:flex-row gap-3 pt-2">
          {/* Filters Button — Admin only */}
          {role === 'ADMIN' && (
            <button
              onClick={() => {
                setFilterDraft(activeFilters as any);
                setIsFilterDrawerOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-[#F6EFE9] text-[#3D2E24] rounded-2xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] hover:shadow-[-6px_-6px_12px_rgba(255,255,255,0.95),6px_6px_12px_rgba(201,180,163,0.7)] active:shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] transition-all font-extrabold text-[14px]"
            >
              <SlidersHorizontal className="h-4.5 w-4.5 text-[#EA580C] shrink-0" />
              Filters {activeFilterCount > 0 && <span className="bg-[#EA580C] text-white px-2 py-0.5 rounded-full text-[11px] ml-1">{activeFilterCount}</span>}
            </button>
          )}

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-[#8C7769]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-[14px] rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] font-semibold placeholder:text-[#8C7769] shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none focus:shadow-[inset_5px_5px_10px_rgba(206,187,172,0.7),inset_-5px_-5px_10px_rgba(255,255,255,0.9)] transition-all"
            />
          </div>

          {/* Priority filter (ADMIN only) */}
          {role === 'ADMIN' && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#8C7769] shrink-0" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="text-[14px] font-extrabold border-0 rounded-2xl px-4 py-3 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Priorities</option>
                {PRIORITY_OPTIONS.map(po => (
                  <option key={po.value} value={po.value}>{po.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort selection */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#8C7769] shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-[14px] font-extrabold border-0 rounded-2xl px-4 py-3 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none cursor-pointer"
            >
              <option value="createdAt">Date Created</option>
              <option value="dueDate">Deadline</option>
              {role === 'ADMIN' && <option value="priority">Priority</option>}
              <option value="title">Title Alphabetical</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-3 border-0 rounded-2xl bg-[#F6EFE9] text-[#3D2E24] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] hover:shadow-[-6px_-6px_12px_rgba(255,255,255,0.95),6px_6px_12px_rgba(201,180,163,0.7)] active:shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] transition-all text-[13px] font-extrabold"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-x-auto p-6 md:p-8 bg-[#F6EFE9]">
        {loading ? (
          <div className="flex gap-5 h-full min-w-max pb-2 items-stretch">
            {KANBAN_COLUMNS.map((column) => (
              <div
                key={column.id}
                className="w-72 flex flex-col bg-[#F6EFE9] rounded-3xl shadow-[-6px_-6px_12px_rgba(255,255,255,0.9),6px_6px_12px_rgba(206,187,172,0.6)] shrink-0 p-4 space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(206,187,172,0.3)]">
                  <span className="font-extrabold text-[12px] text-[#8C7769] animate-pulse uppercase tracking-wider">Loading...</span>
                </div>
                <div className="space-y-3 flex-1">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-28 bg-[#F6EFE9] rounded-2xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-3xl bg-[#F6EFE9] shadow-[inset_4px_4px_8px_rgba(206,187,172,0.55),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] w-full max-w-3xl mx-auto mt-10 p-8 text-center">
              <FilterX className="h-10 w-10 text-[#EA580C] mb-3" />
              <h3 className="text-lg font-extrabold text-[#3D2E24]">No projects match these filters</h3>
              <p className="text-sm text-[#7C6A5A] mb-6">Try adjusting your active filters or clear them to see all projects.</p>
              <Button onClick={handleClearFilters} variant="outline" className="rounded-2xl font-extrabold">Clear Filters</Button>
            </div>
          ) : (
          <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex gap-5 h-full items-stretch min-w-max pb-2">
              {KANBAN_COLUMNS.map((column) => {
                const columnProjects = sortedProjects.filter((p) => p.status === column.id);

                // Determine if this column is a valid drop target for the active project being dragged
                let isValidTarget = true;
                if (role === 'EDITOR' && activeDragProject) {
                  const allowed = getEditorAllowedTargets(activeDragProject.status);
                  isValidTarget = activeDragProject.status === column.id || allowed.includes(column.id);
                }

                const isDraggingAny = activeDragProject !== null;
                const isEditorDragging = role === 'EDITOR' && isDraggingAny;
                const columnDragClass = isEditorDragging
                  ? isValidTarget
                    ? 'shadow-[inset_3px_3px_6px_rgba(234,88,12,0.3)]'
                    : 'opacity-20 cursor-not-allowed select-none pointer-events-none'
                  : 'shadow-[-6px_-6px_12px_rgba(255,255,255,0.9),6px_6px_12px_rgba(206,187,172,0.6)]';

                return (
                  <div
                    key={column.id}
                    className={`w-72 flex flex-col bg-[#F6EFE9] rounded-3xl overflow-hidden border-0 shrink-0 transition-all duration-200 ${columnDragClass}`}
                  >
                    {/* Column Header */}
                    <div className="px-4.5 py-4 border-b border-[rgba(206,187,172,0.3)] bg-[#F6EFE9]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${column.color.split(' ')[0]} shrink-0`} />
                          <h3 className="font-extrabold text-[14px] text-[#3D2E24] uppercase tracking-wide">
                            {column.title}
                          </h3>
                        </div>
                        <span className="text-[11px] font-extrabold text-[#3D2E24] bg-[#F6EFE9] px-2.5 py-0.5 rounded-full shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                          {columnProjects.length}
                        </span>
                      </div>
                    </div>

                    {/* Droppable Area */}
                    <Droppable droppableId={column.id} isDropDisabled={isDraggingAny && !isValidTarget}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex-1 p-3.5 overflow-y-auto space-y-3 min-h-[140px] bg-[#F6EFE9]"
                        >
                          {columnProjects.map((project, index) => {
                            const dueDate = formatCardDate(project.dueDate);
                            const isUpdating = updatingId === project.id;

                            // Use shared helper — mirrors backend exactly
                            const frozenForEditor = role === 'EDITOR' && isFrozenStatus(project.status);
                            const canClientDrag = role === 'CLIENT' && ['EDITING_REVIEW', 'REVISION_1_REVIEW', 'REVISION_2_REVIEW', 'REVISION_3_REVIEW'].includes(project.status);
                            const isDragDisabled = (role === 'CLIENT' && !canClientDrag) || frozenForEditor;

                            // Workflow status badge (shown on cards for editors)
                            const workflowBadge = role !== 'CLIENT' ? getWorkflowBadge(project) : null;

                            return (
                              <Draggable
                                key={project.id}
                                draggableId={project.id}
                                index={index}
                                isDragDisabled={isDragDisabled}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => openProjectDetails(project)}
                                    className={`group relative bg-[#F6EFE9] text-[#3D2E24] rounded-2xl border-0 overflow-hidden select-none flex flex-col transition-all duration-200 shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] hover:shadow-[-6px_-6px_14px_rgba(255,255,255,0.95),6px_6px_14px_rgba(201,180,163,0.75)]
                                      ${snapshot.isDragging ? 'rotate-1 scale-[1.02]' : ''}
                                      ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
                                  >

                                    <div className="p-4.5 flex flex-col gap-3">
                                      {/* Row 1: Standard Name + priority selector (ADMIN) + lock/updating indicator */}
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-extrabold text-[#8C7769] bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] px-2.5 py-1 rounded-xl block truncate flex-1" title={project.standardName}>
                                          {project.standardName}
                                        </span>
                                        {role === 'ADMIN' && (
                                          <select
                                            value={project.priority || 'MEDIUM'}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleUpdatePriority(project.id, e.target.value as any, e)}
                                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-xl border-0 appearance-none cursor-pointer focus:outline-none shrink-0 shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] ${
                                              (project.priority || 'MEDIUM') === 'HIGH'
                                                ? 'text-[#EF4444]'
                                                : (project.priority || 'MEDIUM') === 'LOW'
                                                ? 'text-[#10B981]'
                                                : 'text-[#EA580C]'
                                            }`}
                                          >
                                            {PRIORITY_OPTIONS.map(po => (
                                              <option key={po.value} value={po.value}>{po.shortLabel}</option>
                                            ))}
                                          </select>
                                        )}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {isUpdating && <Loader2 className="h-3.5 w-3.5 text-[#EA580C] animate-spin" />}
                                          {frozenForEditor && <Lock className="h-3.5 w-3.5 text-[#8C7769]" />}
                                        </div>
                                      </div>

                                      {/* Row 2: Title & Flags */}
                                      {project.hasPendingRevisionRequest && (
                                        <div className="mb-1.5">
                                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-[#F6EFE9] text-[#EF4444] shadow-[inset_2px_2px_4px_rgba(239,68,68,0.3)]">
                                            <AlertCircle className="h-3 w-3" />
                                            Pending Review
                                          </span>
                                        </div>
                                      )}
                                      <p className="font-extrabold text-[15px] leading-snug text-[#3D2E24] line-clamp-2 tracking-tight group-hover:text-[#EA580C] transition-colors">
                                        {project.title}
                                      </p>

                                      {/* Row 3: Workflow badge */}
                                      {workflowBadge && (
                                        <div className="flex items-center gap-1.5">
                                          {(() => {
                                            const dotColors: Record<string, string> = {
                                              'Editing':             'bg-amber-400',
                                              'Waiting for Admin':   'bg-indigo-400',
                                              'Revision Requested':  'bg-orange-400',
                                              'Approved':            'bg-emerald-400',
                                              'Uploaded':            'bg-teal-400',
                                            };
                                            return (
                                              <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${workflowBadge.classes}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${dotColors[workflowBadge.label] ?? 'bg-slate-400'} flex-shrink-0`} />
                                                {workflowBadge.label}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                      )}

                                      {/* Row 4: Meta — client + editor */}
                                      <div className="flex flex-col gap-1.5">
                                        {role !== 'EDITOR' && (project.client?.company || project.client?.user?.name) && (
                                          <div className="flex items-center gap-2 min-w-0">
                                            <Briefcase className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                            <span className="text-[12px] text-slate-650 dark:text-slate-350 font-semibold truncate">
                                              {project.client?.company || project.client?.user?.name}
                                            </span>
                                          </div>
                                        )}
                                        {role === 'ADMIN' && (
                                          project.editor ? (
                                            <div className="flex items-center gap-2 min-w-0">
                                              <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                              <span className="text-[12px] text-slate-650 dark:text-slate-350 font-medium truncate">
                                                {project.editor.user.name}
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                              <span className="text-[12px] text-slate-455 dark:text-slate-500 italic">unassigned</span>
                                            </div>
                                          )
                                        )}
                                      </div>

                                      {/* Row 5: Footer — date + financials */}
                                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mt-1 gap-2">
                                        {/* Due date */}
                                        {dueDate ? (
                                          <div className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-lg px-2 py-0.5 border shrink-0
                                            ${dueDate.isOverdue
                                              ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
                                              : dueDate.isUrgentHighlight
                                                ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                                                : 'text-slate-650 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
                                          >
                                            <Clock className="h-3 w-3" />
                                            {dueDate.label}
                                          </div>
                                        ) : <div />}

                                        {/* Financial indicator (ADMIN only) */}
                                        {role === 'ADMIN' && project.clientPrice != null && project.editorPrice != null && (() => {
                                          const cp = Number(project.clientPrice);
                                          const ep = Number(project.editorPrice);
                                          const usdToInr = exchangeRate ? exchangeRate.usdToInr : 83.5;
                                          const editorInUsd = ep / usdToInr;
                                          const marginUsd = cp - editorInUsd;
                                          const marginStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(marginUsd);

                                          return (
                                            <div className="text-right min-w-0 flex-1">
                                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                                                Net Margin: <span className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200">{marginStr}</span>
                                              </span>
                                            </div>
                                          );
                                        })()}

                                        {/* Financial indicator (EDITOR only) */}
                                        {role === 'EDITOR' && project.editorPrice != null && (() => {
                                          const formatted = formatEditorCurrency(project.editorPrice);
                                          return (
                                            <div className="text-right min-w-0 flex-1">
                                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                                                Editor Payout: <span className="font-extrabold text-[12px] text-slate-800 dark:text-slate-200">{formatted}</span>
                                              </span>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}

                          {columnProjects.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex flex-col items-center justify-center py-10 select-none">
                              <p className="text-[12px] text-slate-400 dark:text-slate-600 font-extrabold uppercase tracking-widest">No projects</p>
                              {role === 'ADMIN' && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-650 mt-1 font-medium">Drag cards here</p>
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

      {/* Revision Request Modal for Clients */}
      <RevisionRequestModal
        isOpen={revisionModalState.isOpen}
        project={revisionModalState.project}
        targetStage={revisionModalState.targetStage}
        onClose={() => setRevisionModalState({ isOpen: false, project: null, targetStage: '' })}
        onSubmitSuccess={() => {
          fetchProjects(); // Refresh the board
        }}
      />

      {/* Slide-out Drawer for Project Details */}
      <Drawer
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        size="lg"
      >
        {selectedProject ? (
          <div className="space-y-6 text-[15px] text-slate-800 dark:text-slate-200">
            {/* Upper Stage Header (Sleek Page Title & Stage status) */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#E0D5CB]">
              <div className="space-y-1">
                <h2 className="text-[28px] font-extrabold tracking-tight text-[#3D2E24] leading-tight">
                  {selectedProject.standardName}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <Badge className="text-[12px] px-3.5 py-1.5 font-bold uppercase tracking-wider" variant={selectedProject.status === 'UPLOADED' ? 'success' : 'warning'}>
                  {selectedProject.status.replace(/_/g, ' ').toLowerCase()}
                </Badge>
                {role === 'ADMIN' && (
                  <span className={`text-[12px] px-3.5 py-1.5 font-bold uppercase tracking-wider rounded-xl border ${
                    (selectedProject.priority || 'MEDIUM') === 'HIGH'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : (selectedProject.priority || 'MEDIUM') === 'LOW'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}>
                    {selectedProject.priority || 'MEDIUM'} Priority
                  </span>
                )}
              </div>
            </div>

            {/* 1. Grouped Card: Project Details */}
            <div className="bg-[#F6EFE9] p-6 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-4">
              <h3 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight">Project Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Client Section */}
                {role !== 'EDITOR' && (
                  <div className="space-y-2">
                    <span className="text-[#8C7769] text-[13px] font-extrabold uppercase tracking-wider block">Client (Owner)</span>
                    {role === 'ADMIN' ? (
                      <ClientCombobox
                        clients={clients}
                        value={selectedProject.clientId}
                        isLoading={isSavingField === 'clientId'}
                        onChange={(val) => handleUpdateField('clientId', val)}
                      />
                    ) : (
                      <div className="py-1">
                        <p className="font-bold text-[16px] text-[#3D2E24]">
                          {selectedProject.client?.user?.name}
                        </p>
                        {selectedProject.client?.company && (
                          <p className="text-[14px] text-[#8C7769] font-bold">{selectedProject.client.company}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Editor Section */}
                {role !== 'CLIENT' && (
                  <div className="space-y-2">
                    <span className="text-[#8C7769] text-[13px] font-extrabold uppercase tracking-wider block">Assigned Editor</span>
                    {role === 'ADMIN' ? (
                      <EditorCombobox
                        editors={editors}
                        value={selectedProject.editorId}
                        isLoading={isSavingField === 'editorId'}
                        onChange={(val) => handleUpdateField('editorId', val)}
                      />
                    ) : selectedProject.editor ? (
                      <div className="py-1">
                        <p className="font-bold text-[16px] text-[#3D2E24]">
                          {selectedProject.editor.user.name}
                        </p>
                        {selectedProject.editor.user.email && (
                          <p className="text-[14px] text-[#8C7769] font-normal">{selectedProject.editor.user.email}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[15px] text-[#8C7769] italic font-semibold py-1">No editor assigned</p>
                    )}
                  </div>
                )}

                {/* Priority Section (ADMIN only) */}
                {role === 'ADMIN' && (
                  <div className="space-y-2 relative z-30">
                    <span className="text-[#8C7769] text-[13px] font-extrabold uppercase tracking-wider block">Priority Level</span>
                    <PriorityCombobox
                      value={selectedProject.priority || 'MEDIUM'}
                      disabled={isSavingField === `priority_${selectedProject.id}`}
                      onChange={(val) => handleUpdatePriority(selectedProject.id, val as any)}
                    />
                  </div>
                )}
              </div>

              {/* Submission Date & Deadline Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <span className="text-[#8C7769] text-[13px] font-extrabold uppercase tracking-wider block">Submission Date</span>
                  {role === 'ADMIN' ? (
                    <input
                      type="date"
                      disabled={isSavingField === 'submissionDate'}
                      value={selectedProject.submissionDate ? new Date(selectedProject.submissionDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setSelectedProject(prev => prev ? { ...prev, submissionDate: newVal || '' } : null);
                      }}
                      onBlur={(e) => {
                        handleUpdateField('submissionDate', e.target.value);
                      }}
                      className="w-full text-[14px] p-3 rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none font-semibold"
                    />
                  ) : (
                    <p className="font-semibold text-[#3D2E24] py-1">
                      {selectedProject.submissionDate ? new Date(selectedProject.submissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-[#8C7769] text-[13px] font-extrabold uppercase tracking-wider block">Final Deadline</span>
                  {role === 'ADMIN' ? (
                    <input
                      type="date"
                      disabled={isSavingField === 'dueDate'}
                      value={selectedProject.dueDate ? new Date(selectedProject.dueDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setSelectedProject(prev => prev ? { ...prev, dueDate: newVal || '' } : null);
                      }}
                      onBlur={(e) => {
                        handleUpdateField('dueDate', e.target.value);
                      }}
                      className="w-full text-[14px] p-3 rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none font-semibold"
                    />
                  ) : (
                    <p className="font-semibold text-[#3D2E24] py-1">
                      {selectedProject.dueDate ? new Date(selectedProject.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}

            </div>

            {/* Admin Revision Review Section */}
            {role === 'ADMIN' && selectedProject.revisionRequests && selectedProject.revisionRequests.some((r: any) => r.status === 'PENDING_ADMIN') && (
              <div className="bg-[#F6EFE9] p-6 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-4">
                <h3 className="text-[18px] font-extrabold text-[#EA580C] tracking-tight flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-[#EA580C]" />
                  Pending Revision Review
                </h3>
                {selectedProject.revisionRequests
                  .filter((r: any) => r.status === 'PENDING_ADMIN')
                  .map((req: any) => (
                    <div key={req.id} className="bg-[#F6EFE9] p-5 rounded-2xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] space-y-4">
                      <div>
                        <span className="text-[#8C7769] text-[12px] font-extrabold uppercase tracking-wider block">Target Stage</span>
                        <p className="font-extrabold text-[#3D2E24] mt-0.5">{req.stage.replace(/_/g, ' ')}</p>
                      </div>
                      {req.rawClientInput?.timecodes && (
                        <div>
                          <span className="text-[#8C7769] text-[12px] font-extrabold uppercase tracking-wider block">Client Timecodes</span>
                          <pre className="mt-1 p-3 bg-[#F6EFE9] rounded-xl text-sm text-[#3D2E24] font-mono whitespace-pre-wrap shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
                            {req.rawClientInput.timecodes}
                          </pre>
                        </div>
                      )}
                      {req.rawClientInput?.generalComment && (
                        <div>
                          <span className="text-[#8C7769] text-[12px] font-extrabold uppercase tracking-wider block">Client Comment</span>
                          <p className="mt-1 p-3 bg-[#F6EFE9] rounded-xl text-sm text-[#3D2E24] font-medium shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
                            {req.rawClientInput.generalComment}
                          </p>
                        </div>
                      )}
                      
                      <div className="pt-4 border-t border-[rgba(206,187,172,0.4)] space-y-3">
                        <div className="flex flex-col gap-2">
                           <Label className="text-[13px] font-extrabold text-[#3D2E24]">Final Instructions for Editor</Label>
                           <textarea
                             id={`adminInstructions-${req.id}`}
                             className="w-full p-3.5 rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] font-medium shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none min-h-[85px] placeholder:text-[#8C7769]"
                             placeholder="Translate client comments into clear instructions..."
                           ></textarea>
                        </div>
                        <div className="flex flex-wrap gap-3.5">
                           <Button 
                             className="bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold rounded-2xl px-5 py-2.5 shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px_8px_rgba(234,88,12,0.4)]"
                             onClick={async () => {
                               const el = document.getElementById(`adminInstructions-${req.id}`) as HTMLTextAreaElement;
                               if (!el.value.trim()) { alert('Instructions required'); return; }
                               try {
                                 await api.patch(`/projects/${selectedProject.id}/revisions/${req.id}`, { action: 'APPROVE', adminInstructions: el.value });
                                 fetchProjects();
                                 setSelectedProject(null);
                               } catch (e: any) { alert(e.response?.data?.message || 'Error'); }
                             }}
                           >Approve &amp; Forward to Editor</Button>
                           <Button 
                             variant="outline" 
                             className="bg-[#F6EFE9] text-[#DC2626] font-extrabold rounded-2xl px-4 py-2.5 shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(206,187,172,0.6)] hover:bg-[#DC2626] hover:text-white"
                             onClick={async () => {
                               const msg = prompt('Enter clarification message for the client:');
                               if (!msg) return;
                               try {
                                 await api.patch(`/projects/${selectedProject.id}/revisions/${req.id}`, { action: 'CLARIFY', adminMessage: msg });
                                 fetchProjects();
                                 setSelectedProject(null);
                               } catch (e: any) { alert(e.response?.data?.message || 'Error'); }
                             }}
                           >Request Clarification</Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Approved Revision Instructions (Visible to Editor and Admin) */}
            {selectedProject.revisionRequests && selectedProject.revisionRequests.some((r: any) => r.adminInstructions) && (
              <div className="bg-[#F6EFE9] p-6 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-4">
                <h3 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight flex items-center justify-between">
                  <span>Revision Instructions</span>
                  <span className="text-[12px] font-extrabold px-3 py-1 rounded-full bg-[#F6EFE9] text-[#EA580C] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                    {selectedProject.revisionRequests.filter((r: any) => r.adminInstructions).length} active
                  </span>
                </h3>

                <div className="space-y-4">
                  {selectedProject.revisionRequests
                    .filter((r: any) => r.adminInstructions)
                    .map((req: any) => (
                      <div key={req.id} className="bg-[#F6EFE9] p-5 rounded-2xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] space-y-3">
                        {/* Header: Stage Badge + Timestamp */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-[rgba(206,187,172,0.4)]">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-xl bg-[#F6EFE9] text-[#EA580C] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                              {req.stage.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-[12px] font-bold text-[#8C7769] flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-[#EA580C]" />
                            {req.updatedAt ? formatDate(req.updatedAt) : req.createdAt ? formatDate(req.createdAt) : 'Recently'}
                          </span>
                        </div>

                        {/* Instruction Body */}
                        <div>
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C7769] block mb-1.5">
                            Editor Action Plan:
                          </span>
                          <div className="p-4 rounded-xl bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] font-mono text-[13.5px] leading-relaxed whitespace-pre-wrap">
                            {req.adminInstructions}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 2. Grouped Card: Resources & Deliverables */}
            <div className="bg-[#F6EFE9] p-6 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-4">
              <h3 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight">Resources &amp; Workspace</h3>

              {/* Raw Materials Folder */}
              {(role === 'ADMIN' || selectedProject.rawMaterialsFolder || selectedProject.driveFolder) && (
                <div className="space-y-2">
                  <span className="text-[#8C7769] text-[13px] font-extrabold uppercase tracking-wider block">Raw Materials Link</span>
                  {isEditingRawMaterials ? (
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://drive.google.com/drive/..."
                        value={rawMaterialsUrlInput}
                        onChange={(e) => setRawMaterialsUrlInput(e.target.value)}
                        className="flex-1 text-[14px] p-3 rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none placeholder:text-[#8C7769]"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          handleUpdateField('rawMaterialsFolder', rawMaterialsUrlInput);
                          setIsEditingRawMaterials(false);
                        }}
                        className="rounded-2xl px-5 bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold"
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setIsEditingRawMaterials(false)} className="rounded-2xl px-4 bg-[#F6EFE9] text-[#3D2E24] font-extrabold shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(206,187,172,0.6)]">
                        Cancel
                      </Button>
                    </div>
                  ) : (selectedProject.rawMaterialsFolder || selectedProject.driveFolder) ? (
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
                      <a
                        href={selectedProject.rawMaterialsFolder || selectedProject.driveFolder || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-[#EA580C] hover:text-[#EA580C]/80 transition-colors font-extrabold text-[15px] group"
                      >
                        <span className="underline underline-offset-2 decoration-[#EA580C]/40 group-hover:decoration-[#EA580C] transition-all">Google Drive Folder</span>
                        <ExternalLink className="h-4 w-4 shrink-0" />
                      </a>
                      {role === 'ADMIN' && (
                        <button
                          onClick={() => {
                            setRawMaterialsUrlInput(selectedProject.rawMaterialsFolder || selectedProject.driveFolder || '');
                            setIsEditingRawMaterials(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white text-[13px] font-extrabold shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px_8px_rgba(234,88,12,0.4)] transition-all cursor-pointer"
                        >
                          Edit Link
                        </button>
                      )}
                    </div>
                  ) : (
                    role === 'ADMIN' && (
                      <Button size="sm" onClick={() => {
                        setRawMaterialsUrlInput('');
                        setIsEditingRawMaterials(true);
                      }} className="rounded-2xl w-full py-3 bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px_8px_rgba(234,88,12,0.4)]">
                        Add Google Drive Folder Link
                      </Button>
                    )
                  )}
                </div>
              )}

              {/* Deliverable drafts / Working Files */}
              {(() => {
                const filteredFiles = (selectedProject.files || []).filter((file: any) => {
                  if (role === 'CLIENT') {
                    return file.fileType === 'VIDEO' || file.fileType === 'IMAGE';
                  }
                  return true;
                });

                if (!loadingDetails && filteredFiles.length === 0) {
                  return null;
                }

                return (
                  <div className="space-y-2 pt-2">
                    <span className="text-[#8C7769] text-[13px] font-extrabold uppercase tracking-wider block">
                      {role === 'CLIENT' ? 'Deliverable Output' : 'Working Files & Drafts'}
                    </span>
                    <div className="space-y-2.5">
                      {loadingDetails ? (
                        <div className="h-12 bg-[#F6EFE9] rounded-2xl shadow-[inset_2px_2px_5px_rgba(206,187,172,0.5)] animate-pulse" />
                      ) : (
                        filteredFiles.map((file: any) => (
                          <div key={file.id} className="flex items-center justify-between p-4 bg-[#F6EFE9] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(206,187,172,0.6)] rounded-2xl transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-5 w-5 text-[#EA580C] shrink-0" />
                              <div className="min-w-0">
                                <p className="font-extrabold text-[14px] truncate text-[#3D2E24] leading-normal">{file.originalName}</p>
                                <p className="text-[12px] text-[#8C7769] mt-0.5">Version {file.version} · {formatDate(file.createdAt)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 text-[#7C6A5A] hover:text-[#EA580C] transition-colors rounded-xl bg-[#F6EFE9] shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),2px_2px_5px_rgba(206,187,172,0.5)]"
                              >
                                <ExternalLink className="h-4.5 w-4.5" />
                              </a>
                              {role === 'ADMIN' && (
                                <button
                                  onClick={async () => {
                                    if (confirm('Are you sure you want to delete this file?')) {
                                      try {
                                        await api.delete(`/projects/${selectedProject.id}/files/${file.id}`);
                                        setSelectedProject(prev => prev ? { ...prev, files: prev.files?.filter(f => f.id !== file.id) } : null);
                                      } catch (err) {
                                        alert('Failed to delete file.');
                                      }
                                    }
                                  }}
                                  className="p-2 text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-all rounded-xl cursor-pointer"
                                  title="Delete File"
                                >
                                  <Trash className="h-4.5 w-4.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 4. Grouped Card: Editor Discussions (ADMIN and EDITOR only) */}
              {role !== 'CLIENT' && (
                <div className="bg-[#F6EFE9] p-6 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-4">
                  <h3 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight">Editor Discussions</h3>

                  <div className="space-y-3">
                    {/* General Discussion */}
                    <Link
                      href={`/projects/${selectedProject.standardSlug}/discussions/general`}
                      className="group flex items-center justify-between p-4 bg-[#F6EFE9] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] rounded-2xl hover:shadow-[-6px_-6px_14px_rgba(255,255,255,0.95),6px_6px_14px_rgba(201,180,163,0.7)] transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
                          <MessageSquare className="h-4.5 w-4.5 text-[#EA580C]" />
                        </div>
                        <span className="font-extrabold text-[15px] text-[#3D2E24] group-hover:text-[#EA580C] transition-colors">General Discussion</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-extrabold px-3 py-1 rounded-xl bg-[#F6EFE9] text-[#EA580C] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                          {getCommentCount('GENERAL', comments)} comments
                        </span>
                        <ChevronRight className="h-4 w-4 text-[#8C7769] group-hover:text-[#EA580C] group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>
                    </Link>

                    {/* Revision 1 Discussion */}
                    {(() => {
                      const availableTabs = getAvailableTabs(selectedProject.status, comments);
                      if (!availableTabs.includes('REVISION_1')) return null;
                      return (
                        <Link
                          href={`/projects/${selectedProject.standardSlug}/discussions/revision-1`}
                          className="group flex items-center justify-between p-4 bg-[#F6EFE9] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] rounded-2xl hover:shadow-[-6px_-6px_14px_rgba(255,255,255,0.95),6px_6px_14px_rgba(201,180,163,0.7)] transition-all duration-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
                              <MessageSquare className="h-4.5 w-4.5 text-[#F59E0B]" />
                            </div>
                            <span className="font-extrabold text-[15px] text-[#3D2E24] group-hover:text-[#F59E0B] transition-colors">Revision 1 Discussion</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-extrabold px-3 py-1 rounded-xl bg-[#F6EFE9] text-[#F59E0B] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                              {getCommentCount('REVISION_1', comments)} comments
                            </span>
                            <ChevronRight className="h-4 w-4 text-[#8C7769] group-hover:text-[#F59E0B] group-hover:translate-x-0.5 transition-all duration-200" />
                          </div>
                        </Link>
                      );
                    })()}

                    {/* Revision 2 Discussion */}
                    {(() => {
                      const availableTabs = getAvailableTabs(selectedProject.status, comments);
                      if (!availableTabs.includes('REVISION_2')) return null;
                      return (
                        <Link
                          href={`/projects/${selectedProject.standardSlug}/discussions/revision-2`}
                          className="group flex items-center justify-between p-4 bg-[#F6EFE9] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] rounded-2xl hover:shadow-[-6px_-6px_14px_rgba(255,255,255,0.95),6px_6px_14px_rgba(201,180,163,0.7)] transition-all duration-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
                              <MessageSquare className="h-4.5 w-4.5 text-[#EF4444]" />
                            </div>
                            <span className="font-extrabold text-[15px] text-[#3D2E24] group-hover:text-[#EF4444] transition-colors">Revision 2 Discussion</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-extrabold px-3 py-1 rounded-xl bg-[#F6EFE9] text-[#EF4444] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                              {getCommentCount('REVISION_2', comments)} comments
                            </span>
                            <ChevronRight className="h-4 w-4 text-[#8C7769] group-hover:text-[#EF4444] group-hover:translate-x-0.5 transition-all duration-200" />
                          </div>
                        </Link>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Grouped Card: Financial Summary (ADMIN only) */}
             {role === 'ADMIN' && (
               <div className="bg-[#F6EFE9] p-6 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-4">
                 <h3 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight">Financial breakdown</h3>
                 
                 {/* 2-column input fields */}
                 <div className="grid grid-cols-2 gap-4 bg-[#F6EFE9] p-4 rounded-2xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
                   {(() => {
                      const clientCurr = (selectedProject.client?.currency || 'USD').toUpperCase();
                      const clientCurrSym = getCurrencySymbol(clientCurr);
                      return (
                        <>
                          <div>
                            <span className="text-[12px] text-[#8C7769] block font-extrabold uppercase tracking-wider">
                              Client budget <span className="text-[#EA580C] font-extrabold">{clientCurr}</span>
                            </span>
                            <div className="relative mt-1.5">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-extrabold text-[#8C7769] pointer-events-none">{clientCurrSym}</span>
                              <input
                                type="number"
                                disabled={isSavingField === 'clientPrice'}
                                value={selectedProject.clientPrice !== null && selectedProject.clientPrice !== undefined ? selectedProject.clientPrice : ''}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setSelectedProject(prev => {
                                    if (!prev) return null;
                                    const clientPrice = newVal === '' ? null : Number(newVal);
                                    return { ...prev, clientPrice };
                                  });
                                }}
                                onBlur={(e) => {
                                  handleUpdateField('clientPrice', e.target.value === '' ? null : Number(e.target.value));
                                }}
                                className="w-full text-[14px] pl-[30px] pr-3 py-2.5 rounded-xl border-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none font-extrabold"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <span className="text-[12px] text-[#8C7769] block font-extrabold uppercase tracking-wider">
                              Editor amount <span className="text-[#EA580C] font-extrabold">INR</span>
                            </span>
                            <div className="relative mt-1.5">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-extrabold text-[#8C7769] pointer-events-none">₹</span>
                              <input
                                type="number"
                                disabled={isSavingField === 'editorPrice'}
                                value={selectedProject.editorPrice !== null && selectedProject.editorPrice !== undefined ? selectedProject.editorPrice : ''}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setSelectedProject(prev => {
                                    if (!prev) return null;
                                    const editorPrice = newVal === '' ? null : Number(newVal);
                                    return { ...prev, editorPrice };
                                  });
                                }}
                                onBlur={(e) => {
                                  handleUpdateField('editorPrice', e.target.value === '' ? null : Number(e.target.value));
                                }}
                                className="w-full text-[14px] pl-[30px] pr-3 py-2.5 rounded-xl border-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none font-extrabold"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                 </div>

                 {/* Net Margin block */}
                 <div className="pt-4 border-t border-[#E0D5CB] mt-4">
                   <span className="text-[12px] text-[#8C7769] block font-extrabold uppercase tracking-wider">
                     Company profit (net margin)
                   </span>
                   {(() => {
                      const cp = selectedProject.clientPrice != null ? Number(selectedProject.clientPrice) : 0;
                      const ep = selectedProject.editorPrice != null ? Number(selectedProject.editorPrice) : 0;
                      const isZeroOrUnset = (selectedProject.clientPrice == null || Number(selectedProject.clientPrice) === 0) &&
                                            (selectedProject.editorPrice == null || Number(selectedProject.editorPrice) === 0);

                      let primaryMarginStr = '';
                      let breakdownStr = '';
                      let fxRateStr = '';

                      // 1. Calculate margin using exchange rate
                      const rate = exchangeRate ? exchangeRate.usdToInr : 83.50;
                      const editorInUsd = ep / rate;
                      const marginUsd = cp - editorInUsd;

                      // 2. Format primary margin and breakdown
                      if (isZeroOrUnset) {
                        primaryMarginStr = '$0.00 margin';
                        breakdownStr = '$0.00 (USD) / \u20b90 (INR)';
                      } else {
                        primaryMarginStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(marginUsd);
                        breakdownStr = `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cp)} billed \u2192 ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(ep)} paid out`;
                      }

                      // 3. Format exchange rate label with correct live vs default/fallback status
                      if (exchangeRate) {
                        if (exchangeRate.isFallback) {
                          fxRateStr = `1 USD = \u20b9${exchangeRate.usdToInr.toFixed(2)} \u00b7 default rate`;
                        } else {
                          fxRateStr = `1 USD = \u20b9${exchangeRate.usdToInr.toFixed(2)} \u00b7 ${formatFetchedAgo(exchangeRate.fetchedAt)}`;
                        }
                      } else {
                        fxRateStr = `1 USD = \u20b983.50 \u00b7 default rate`;
                      }

                     return (
                       <div className="space-y-1 mt-1.5">
                         <span className="font-black text-[32px] text-[#16A34A] block leading-tight">
                           ≈ {primaryMarginStr}
                         </span>
                         {breakdownStr && (
                           <span className="text-[14px] text-[#3D2E24] block font-bold leading-tight mt-1.5">
                             {breakdownStr}
                           </span>
                         )}
                         <div className="flex items-center justify-between mt-4 text-[12px] text-[#8C7769] font-medium">
                           <span>
                             {fxRateStr}
                           </span>
                           <button
                             onClick={async () => {
                               try {
                                 const res = await api.get('/exchange-rate?force=true');
                                 queryClient.setQueryData(['exchange-rate'], res.data.data);
                               } catch (err) {
                                 console.error('Failed to force refresh exchange rate:', err);
                                 await queryClient.invalidateQueries({ queryKey: ['exchange-rate'] });
                               }
                             }}
                             className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F6EFE9] shadow-[-2px_-2px_5px_rgba(255,255,255,0.8),2px_2px_5px_rgba(206,187,172,0.5)] hover:shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(206,187,172,0.6)] transition-all text-[11px] font-bold text-[#7C6A5A] cursor-pointer"
                           >
                             <RefreshCw className="h-3.5 w-3.5" />
                             Refresh
                           </button>
                         </div>
                       </div>
                     );
                   })()}
                    </div>

                    {/* Associated invoices inside financial card */}
                    {selectedProject.invoices && selectedProject.invoices.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#E0D5CB]">
                        <span className="text-[#8C7769] text-[13px] font-extrabold uppercase tracking-wider block">Associated invoices</span>
                        <div className="space-y-2">
                          {selectedProject.invoices.map((inv: any) => (
                            <div key={inv.id} className="flex items-center justify-between p-4 bg-[#F6EFE9] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(206,187,172,0.6)] rounded-2xl">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-[#EA580C]" />
                                <div>
                                  <p className="font-extrabold text-[14px] text-[#3D2E24]">{inv.number}</p>
                                  <p className="text-[12px] text-[#8C7769]">Due {formatDate(inv.dueDate)}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-extrabold text-[14px] text-[#3D2E24]">{formatCurrency(inv.total)}</p>
                                <Badge className="text-[10px] py-0.5 px-2 font-bold capitalize mt-1" variant={inv.status === 'PAID' ? 'success' : 'secondary'}>
                                  {inv.status.toLowerCase()}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

             {/* Financial Summary (EDITOR only) */}
             {role === 'EDITOR' && selectedProject.editorPrice != null && (
               <div className="bg-[#F6EFE9] p-6 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-4">
                 <h3 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight">Payment Details</h3>
                 <div className="bg-[#F6EFE9] p-4 rounded-2xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
                   <span className="text-[12px] text-[#8C7769] block font-extrabold uppercase tracking-wider">
                     Editor Payout <span className="text-[#EA580C] font-extrabold">INR</span>
                   </span>
                   <p className="font-extrabold text-[24px] text-[#3D2E24] mt-1.5 leading-none">
                     {formatEditorCurrency(selectedProject.editorPrice)}
                   </p>
                 </div>
               </div>
             )}

            {/* 5. Grouped Card: Workstation Actions */}
            {role === 'EDITOR' ? (
              <div className="bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <h3 className="text-[18px] font-extrabold text-slate-900 dark:text-white tracking-tight">Submit Review Folder</h3>
                <div className="space-y-2">
                  <form onSubmit={handleEditorUpload} className="flex gap-2">
                    <input
                      type="url"
                      required
                      placeholder="Paste link to Google Drive review folder..."
                      value={uploadUrl}
                      onChange={(e) => setUploadUrl(e.target.value)}
                      className="flex-1 text-[14px] p-3 rounded-xl border border-slate-300 dark:border-slate-750 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingFile}
                      className="bg-accent text-white font-black px-5 py-3 rounded-xl text-[14px] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isSubmittingFile ? 'Submitting...' : 'Upload Link'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <h3 className="text-[18px] font-extrabold text-slate-900 dark:text-white tracking-tight">Available actions</h3>

                {role === 'ADMIN' && (
                  <div className="flex flex-col gap-4">
                    <div className="space-y-2">
                      <span className="text-[12px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Update workflow stage</span>
                      <div className="flex flex-wrap gap-2">
                        {['NEW_VIDEO', 'EDITING', 'EDITING_REVIEW', 'REVISION_1', 'REVISION_1_REVIEW', 'REVISION_2', 'REVISION_2_REVIEW', 'REVISION_3', 'REVISION_3_REVIEW', 'FINAL_DRAFT', 'UPLOADED'].map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusUpdate(selectedProject.id, s)}
                            className={`text-[12px] font-bold border px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${selectedProject.status === s
                                ? 'bg-accent text-white border-accent shadow-sm'
                                : 'border-slate-350 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900'
                              }`}
                          >
                            {s.replace(/_/g, ' ').toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <a
                      href={`/admin/projects`}
                      className="w-full flex items-center justify-center bg-slate-900 dark:bg-slate-800 text-white py-3 rounded-xl font-extrabold text-center hover:opacity-90 transition-opacity border border-slate-300 dark:border-slate-700 shadow-sm text-[15px]"
                    >
                      Edit Project Configurations
                    </a>
                  </div>
                )}

                {role === 'CLIENT' && (
                  <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/10 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
                    <Lock className="h-5 w-5 text-slate-400 shrink-0" />
                    <span className="text-[14px] text-slate-550 leading-relaxed">
                      You have read-only permissions for this workspace. Changes can be updated by contacting the master account Admin.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Danger Zone — Delete Project (ADMIN only, bottom of drawer) */}
            {role === 'ADMIN' && (
              <div className="pt-6 mt-2 border-t border-[#E0D5CB]">
                <div className="bg-[#F6EFE9] p-4 rounded-2xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-extrabold text-[#3D2E24]">Danger Zone</p>
                      <p className="text-[12px] text-[#8C7769] mt-0.5">Permanently delete this project and all associated data.</p>
                    </div>
                    <button
                      onClick={() => handleDeleteProject(selectedProject.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-extrabold text-[#DC2626] bg-[#F6EFE9] shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(206,187,172,0.6)] hover:bg-[#DC2626] hover:text-white hover:shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px_8px_rgba(220,38,38,0.4)] transition-all cursor-pointer"
                      title="Delete Project Completely"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Project
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        )}
      </Drawer>

      {/* Add Project Drawer */}
      {/* Add Project Drawer */}
      <Drawer
        isOpen={isCreateProjectOpen}
        onClose={() => {
          setIsCreateProjectOpen(false);
          resetCreateProjectForm();
        }}
        title="Add Project"
        description="Initialize a new production video project in the system."
        size="lg"
        className="max-w-[1000px] bg-slate-50/50 dark:bg-slate-950/20"
      >
        <form onSubmit={handleCreateProjectSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Project Details (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card 1: Basic details */}
              <div className="bg-[#F6EFE9] p-8 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-5 border-0">
                <h4 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight">Basic Details</h4>
                
                <div className="space-y-3.5">
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="projectTitle" className="text-[13px] font-extrabold text-[#8C7769]">Project Title</Label>
                    <input
                      id="projectTitle"
                      required
                      placeholder="e.g. Autumn Collection Promo Video"
                      value={newProjectTitle}
                      onChange={(e) => setNewProjectTitle(e.target.value)}
                      className="w-full text-[15px] px-4 py-3 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none focus:shadow-[inset_5px_5px_10px_rgba(206,187,172,0.7),inset_-5px_-5px_10px_rgba(255,255,255,0.9)] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="projectDesc" className="text-[13px] font-extrabold text-[#8C7769]">Description</Label>
                    <textarea
                      id="projectDesc"
                      placeholder="Enter project overview, style guidelines, or specific briefs..."
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      className="w-full text-[15px] px-4 py-3 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none focus:shadow-[inset_5px_5px_10px_rgba(206,187,172,0.7),inset_-5px_-5px_10px_rgba(255,255,255,0.9)] transition-all h-20 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Stakeholders & dates */}
              <div className="bg-[#F6EFE9] py-6 px-8 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-4 border-0">
                <h4 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight">Stakeholders & Schedule</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5 text-left">
                    <Label className="text-[13px] font-extrabold text-[#8C7769]">Client Owner</Label>
                    <ClientCombobox
                      clients={clients}
                      value={newProjectClientId}
                      onChange={(val) => setNewProjectClientId(val)}
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <Label className="text-[13px] font-extrabold text-[#8C7769]">Assigned Editor</Label>
                    <EditorCombobox
                      editors={editors}
                      value={newProjectEditorId || null}
                      onChange={(val) => setNewProjectEditorId(val || '')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="projectSubDate" className="text-[13px] font-extrabold text-[#8C7769]">Submission Date</Label>
                    <div className="relative w-full">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7769] pointer-events-none" />
                      <input
                        id="projectSubDate"
                        type="date"
                        value={newProjectSubDate}
                        onChange={(e) => setNewProjectSubDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none text-[15px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="projectDueDate" className="text-[13px] font-extrabold text-[#8C7769]">Final Deadline</Label>
                    <div className="relative w-full">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7769] pointer-events-none" />
                      <input
                        id="projectDueDate"
                        type="date"
                        value={newProjectDueDate}
                        onChange={(e) => setNewProjectDueDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none text-[15px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Asset links */}
              <div className="bg-[#F6EFE9] py-6 px-8 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-4 border-0">
                <h4 className="text-[18px] font-extrabold text-[#3D2E24] tracking-tight">Assets & Links</h4>
                
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="projectRawMaterials" className="text-[13px] font-extrabold text-[#8C7769]">Raw Materials Google Drive Link</Label>
                  <input
                    id="projectRawMaterials"
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={newProjectRawMaterials}
                    onChange={(e) => setNewProjectRawMaterials(e.target.value)}
                    className="w-full text-[15px] px-4 py-3 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Finance & Margin Summary (1/3 width) */}
            <div className="lg:col-span-1">
              <div className="sticky top-0 bg-[#F6EFE9] p-8 border-0 rounded-3xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(206,187,172,0.65)] space-y-6 relative overflow-hidden">
                
                <h4 className="text-[18px] font-extrabold text-[#EA580C] tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#EA580C]" /> Finance
                </h4>

                <div className="space-y-4 relative z-10">
                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="projectClientPrice" className="text-[13px] font-extrabold text-[#8C7769]">Client Budget</Label>
                    <div className="relative w-full">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7769] font-bold text-[15px]">$</span>
                      <input
                        id="projectClientPrice"
                        type="number"
                        step="10"
                        placeholder="500.00"
                        value={newProjectClientPrice}
                        onChange={(e) => setNewProjectClientPrice(e.target.value)}
                        className="w-full pl-8 pr-16 py-3 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setNewProjectClientPrice(prev => String(Math.max(0, (Number(prev) || 0) - 10)))}
                          className="w-6 h-6 rounded-lg bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold text-[12px] flex items-center justify-center cursor-pointer select-none"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewProjectClientPrice(prev => String((Number(prev) || 0) + 10))}
                          className="w-6 h-6 rounded-lg bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold text-[12px] flex items-center justify-center cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <Label htmlFor="projectEditorPrice" className="text-[13px] font-extrabold text-[#8C7769]">Editor Amount (INR)</Label>
                    <div className="relative w-full">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7769] font-bold text-[15px]">₹</span>
                      <input
                        id="projectEditorPrice"
                        type="number"
                        step="10"
                        placeholder="200.00"
                        value={newProjectEditorPrice}
                        onChange={(e) => setNewProjectEditorPrice(e.target.value)}
                        className="w-full pl-8 pr-16 py-3 bg-[#F6EFE9] text-[#3D2E24] font-semibold border-0 rounded-2xl shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setNewProjectEditorPrice(prev => String(Math.max(0, (Number(prev) || 0) - 10)))}
                          className="w-6 h-6 rounded-lg bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold text-[12px] flex items-center justify-center cursor-pointer select-none"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewProjectEditorPrice(prev => String((Number(prev) || 0) + 10))}
                          className="w-6 h-6 rounded-lg bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] font-extrabold text-[12px] flex items-center justify-center cursor-pointer select-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Calculations breakdown */}
                  <div className="border-t border-[rgba(206,187,172,0.4)] pt-6 mt-6 space-y-3">
                    <div className="flex justify-between text-sm text-[#7C6A5A] font-extrabold">
                      <span>Revenue</span>
                      <span className="text-[#3D2E24] font-extrabold">${Number(newProjectClientPrice) || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm text-[#7C6A5A] font-extrabold">
                      <span>Editor Cost</span>
                      <span className="text-[#EF4444] font-extrabold">-${Number(newProjectEditorPrice) || 0}</span>
                    </div>
                    
                    <div className="border-t border-[rgba(206,187,172,0.3)] pt-4 flex justify-between items-center text-[#3D2E24]">
                      <div>
                        <span className="text-sm font-extrabold text-[#3D2E24] leading-tight block">Company Profit (Net Margin)</span>
                        <span className="text-[10px] text-[#8C7769] font-normal">Calculated estimate</span>
                      </div>
                      <span className="text-[28px] font-extrabold text-[#EA580C] tracking-tight leading-none">
                        ${(Number(newProjectClientPrice) || 0) - (Number(newProjectEditorPrice) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsCreateProjectOpen(false);
                resetCreateProjectForm();
              }}
              className="rounded-xl cursor-pointer font-bold px-5 py-3 text-[14px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isCreatingProject}
              disabled={isCreatingProject}
              className="bg-accent hover:bg-accent/90 border-transparent text-white font-extrabold text-[15px] rounded-xl px-7 py-3.5 focus:ring-4 focus:ring-accent/20 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              Add Project
            </Button>
          </div>
        </form>
      </Drawer>

      {/* ── Filter Drawer ─────────────────────────────────────────────── */}
      <Drawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        title="Advanced Filters"
        description="Refine the project board view using multiple conditions."
        size="md"
      >
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">

              <div className="space-y-1.5">
                <Label className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Client</Label>
                <select 
                  className="w-full h-11 border-0 rounded-2xl px-4 py-2 bg-[#F6EFE9] text-[#3D2E24] font-semibold text-sm outline-none shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] cursor-pointer"
                  value={filterDraft.client || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, client: e.target.value }))}
                >
                  <option value="">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.user?.name}</option>)}
                </select>
              </div>

              {role === 'ADMIN' && (
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Assigned Editor</Label>
                  <select 
                    className="w-full h-11 border-0 rounded-2xl px-4 py-2 bg-[#F6EFE9] text-[#3D2E24] font-semibold text-sm outline-none shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] cursor-pointer"
                    value={filterDraft.editor || ''}
                    onChange={e => setFilterDraft(p => ({ ...p, editor: e.target.value }))}
                  >
                    <option value="">All Editors</option>
                    {editors.map(e => <option key={e.id} value={e.id}>{e.user?.name}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Status</Label>
                <select 
                  className="w-full h-11 border-0 rounded-2xl px-4 py-2 bg-[#F6EFE9] text-[#3D2E24] font-semibold text-sm outline-none shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] cursor-pointer"
                  value={filterDraft.status || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, status: e.target.value }))}
                >
                  <option value="">All Statuses</option>
                  {uniqueStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Priority</Label>
                <select 
                  className="w-full h-11 border-0 rounded-2xl px-4 py-2 bg-[#F6EFE9] text-[#3D2E24] font-semibold text-sm outline-none shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] cursor-pointer"
                  value={filterDraft.priority || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, priority: e.target.value }))}
                >
                  <option value="">All Priorities</option>
                  {PRIORITY_OPTIONS.map(po => <option key={po.value} value={po.value}>{po.label}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Deadline Month</Label>
                <input 
                  type="month"
                  className="w-full h-11 border-0 rounded-2xl px-4 py-2 bg-[#F6EFE9] text-[#3D2E24] font-semibold text-sm outline-none shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]"
                  value={filterDraft.month || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, month: e.target.value }))}
                />
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Submission Date</Label>
              <div className="grid grid-cols-2 gap-4 mt-1.5">
                <input 
                  type="date"
                  title="From"
                  className="w-full h-11 border-0 rounded-2xl px-4 py-2 bg-[#F6EFE9] text-[#3D2E24] font-semibold text-sm outline-none shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]"
                  value={filterDraft.subFrom || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, subFrom: e.target.value }))}
                />
                <input 
                  type="date"
                  title="To"
                  className="w-full h-11 border-0 rounded-2xl px-4 py-2 bg-[#F6EFE9] text-[#3D2E24] font-semibold text-sm outline-none shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]"
                  value={filterDraft.subTo || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, subTo: e.target.value }))}
                />
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Deadline</Label>
              <div className="grid grid-cols-2 gap-4 mt-1.5">
                <input 
                  type="date"
                  title="From"
                  className="w-full h-11 border-0 rounded-2xl px-4 py-2 bg-[#F6EFE9] text-[#3D2E24] font-semibold text-sm outline-none shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]"
                  value={filterDraft.dueFrom || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, dueFrom: e.target.value }))}
                />
                <input 
                  type="date"
                  title="To"
                  className="w-full h-11 border-0 rounded-2xl px-4 py-2 bg-[#F6EFE9] text-[#3D2E24] font-semibold text-sm outline-none shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)]"
                  value={filterDraft.dueTo || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, dueTo: e.target.value }))}
                />
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Project Value</Label>
              <div className="grid grid-cols-2 gap-4 mt-1.5">
                <input 
                  type="number"
                  placeholder="Min"
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-sm focus:ring-1 focus:ring-accent outline-none text-slate-700 dark:text-slate-200"
                  value={filterDraft.valMin || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, valMin: e.target.value }))}
                />
                <input 
                  type="number"
                  placeholder="Max"
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-sm focus:ring-1 focus:ring-accent outline-none text-slate-700 dark:text-slate-200"
                  value={filterDraft.valMax || ''}
                  onChange={e => setFilterDraft(p => ({ ...p, valMax: e.target.value }))}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filterDraft.overdue === 'true'}
                  onChange={e => setFilterDraft(p => ({ ...p, overdue: e.target.checked ? 'true' : '', dueWeek: e.target.checked ? '' : p.dueWeek }))}
                  className="rounded border-slate-300 text-accent focus:ring-accent"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Overdue Only</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filterDraft.dueWeek === 'true'}
                  onChange={e => setFilterDraft(p => ({ ...p, dueWeek: e.target.checked ? 'true' : '', overdue: e.target.checked ? '' : p.overdue }))}
                  className="rounded border-slate-300 text-accent focus:ring-accent"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Due This Week</span>
              </label>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClearFilters}
              className="rounded-xl font-bold"
            >
              Clear All
            </Button>
            <Button
              type="button"
              onClick={handleApplyFilters}
              className="bg-accent hover:bg-accent/90 text-white font-bold rounded-xl px-6 border-transparent"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
