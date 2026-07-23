'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Trash2,
  Loader2,
  ChevronRight,
  FolderKanban,
  Hash
} from 'lucide-react';
import Link from 'next/link';

function getAvailableTabs(status: string, commentsList: any[]): string[] {
  const tabs = ['GENERAL'];
  const hasRevision1Comments = commentsList.some(c => c.content?.startsWith('[Revision 1] '));
  const hasRevision2Comments = commentsList.some(c => c.content?.startsWith('[Revision 2] '));

  const isAtOrAfterRevision1 = [
    'REVISION_1', 'REVISION_1_REVIEW', 'REVISION_2',
    'REVISION_2_REVIEW', 'FINAL_DRAFT', 'UPLOADED'
  ].includes(status) || hasRevision1Comments;

  if (isAtOrAfterRevision1) tabs.push('REVISION_1');

  const enteredRevision2 = ['REVISION_2', 'REVISION_2_REVIEW'].includes(status) || hasRevision2Comments;
  if (enteredRevision2) tabs.push('REVISION_2');

  return tabs;
}

function cleanCommentContent(content: string): string {
  if (content?.startsWith('[Revision 1] ')) return content.slice('[Revision 1] '.length);
  if (content?.startsWith('[Revision 2] ')) return content.slice('[Revision 2] '.length);
  return content;
}

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatFriendlyTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday) return `Today at ${timeStr}`;
  const datePart = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${datePart}, ${timeStr}`;
}

// Returns accent color tokens per discussion type
function getDiscussionColors(discussionType: string) {
  if (discussionType === 'revision-1') return {
    icon: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    ring: 'focus-within:ring-amber-500/30',
  };
  if (discussionType === 'revision-2') return {
    icon: 'text-rose-400',
    iconBg: 'bg-rose-500/15',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    ring: 'focus-within:ring-rose-500/30',
  };
  return {
    icon: 'text-accent',
    iconBg: 'bg-accent/15',
    badge: 'bg-accent/20 text-accent border-accent/30',
    ring: 'focus-within:ring-accent/30',
  };
}

export default function DiscussionPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;
  const discussionType = params?.discussionType as string;

  const { user } = useAuthStore();
  const [project, setProject] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const getDiscussionKey = () => {
    if (discussionType === 'revision-2') return 'REVISION_2';
    if (discussionType === 'revision-1') return 'REVISION_1';
    return 'GENERAL';
  };

  const getDiscussionTitle = () => {
    if (discussionType === 'revision-2') return 'Revision 2 Discussion';
    if (discussionType === 'revision-1') return 'Revision 1 Discussion';
    return 'General Discussion';
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!projectId || !user) return;
    const loadData = async () => {
      try {
        setLoading(true);
        const projectRes = await api.get(`/projects/${projectId}`);
        const projectData = projectRes.data.data;
        setProject(projectData);

        const commentsRes = await api.get(`/projects/${projectId}/comments`);
        const commentsList = commentsRes.data.data || [];
        setComments(commentsList);

        if (user.role === 'CLIENT') { router.replace('/unauthorized'); return; }

        if (user.role === 'EDITOR') {
          const isAssigned = projectData.editor?.user?.id === user.id;
          if (!isAssigned) { router.replace('/unauthorized'); return; }
        }

        const activeKey = getDiscussionKey();
        const boardHref = user.role === 'ADMIN' ? '/admin' : '/editor/board';
        const unlockedTabs = getAvailableTabs(projectData.status, commentsList);
        if (!unlockedTabs.includes(activeKey)) {
          router.replace(boardHref);
        }
      } catch (err) {
        console.error('Failed to load discussion details:', err);
        router.replace(user.role === 'ADMIN' ? '/admin' : '/editor/board');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId, user, discussionType]);

  useEffect(() => {
    if (project?.standardName) {
      document.title = `${project.standardName} - ${getDiscussionTitle()}`;
    }
  }, [project, discussionType]);

  useEffect(() => { if (!loading) scrollToBottom(); }, [comments, loading]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting || !project) return;
    setSubmitting(true);
    try {
      let finalContent = newComment.trim();
      const activeKey = getDiscussionKey();
      if (activeKey === 'REVISION_1') finalContent = `[Revision 1] ${finalContent}`;
      else if (activeKey === 'REVISION_2') finalContent = `[Revision 2] ${finalContent}`;

      const res = await api.post(`/projects/${projectId}/comments`, { content: finalContent });
      setComments((prev) => [...prev, res.data.data]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to submit comment:', err);
      alert('Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (user?.role !== 'ADMIN') return;
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.delete(`/projects/${projectId}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Failed to delete comment.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm font-semibold text-slate-400">Loading discussion thread...</p>
      </div>
    );
  }

  if (!project) return null;

  const activeKey = getDiscussionKey();
  const colors = getDiscussionColors(discussionType);

  const filteredComments = comments.filter((c) => {
    if (activeKey === 'GENERAL') return !c.content?.startsWith('[Revision 1] ') && !c.content?.startsWith('[Revision 2] ');
    if (activeKey === 'REVISION_1') return c.content?.startsWith('[Revision 1] ');
    if (activeKey === 'REVISION_2') return c.content?.startsWith('[Revision 2] ');
    return true;
  });

  const boardUrl = user?.role === 'ADMIN'
    ? `/admin/projects?open=${projectId}`
    : `/editor/board?open=${projectId}`;
  const handleBack = () => router.push(boardUrl);

  return (
    <div className="max-w-6xl mx-auto space-y-5 px-4 md:px-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] text-slate-500 font-medium">
        <button
          onClick={handleBack}
          className="hover:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <FolderKanban className="h-3.5 w-3.5" />
          Projects
        </button>
        <ChevronRight className="h-3 w-3 text-slate-600" />
        <span className="truncate max-w-[240px] text-slate-400 font-semibold">
          {project.standardName}
        </span>
        <ChevronRight className="h-3 w-3 text-slate-600" />
        <span className="text-slate-200 font-bold">{getDiscussionTitle()}</span>
      </div>

      {/* Title Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-black text-white leading-tight tracking-tight">
            {getDiscussionTitle()}
          </h1>
          <p className="text-[14px] text-slate-400 font-medium mt-0.5">
            Internal collaboration ·{' '}
            <span className="font-extrabold text-slate-200">{project.standardName}</span>
          </p>
        </div>

        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700/80 border border-slate-600/60 text-white text-[14px] font-bold hover:bg-slate-600/80 hover:border-slate-500 active:scale-95 transition-all shadow-md cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Board
        </button>
      </div>

      {/* Main Chat Container */}
      <div className="bg-slate-950/80 border border-slate-800/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[74vh]">

        {/* Channel Header */}
        <div className="px-6 py-3.5 border-b border-slate-800/70 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-xl ${colors.iconBg} flex items-center justify-center shrink-0`}>
              <MessageSquare className={`h-4 w-4 ${colors.icon}`} />
            </div>
            <div>
              <span className="text-[14px] font-bold text-slate-100 tracking-wide">
                {getDiscussionTitle()}
              </span>
              <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                {filteredComments.length} message{filteredComments.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${colors.badge}`}>
            {discussionType}
          </span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {filteredComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className={`h-14 w-14 rounded-2xl ${colors.iconBg} flex items-center justify-center`}>
                <MessageSquare className={`h-6 w-6 ${colors.icon} stroke-[1.5]`} />
              </div>
              <p className="text-[15px] font-bold text-slate-300">No messages yet.</p>
              <p className="text-[13px] font-medium text-slate-600">Be the first to post a message below.</p>
            </div>
          ) : (
            filteredComments.map((c) => {
              const initials = getInitials(c.author?.name || 'User');
              const isAuthorAdmin = c.author?.role === 'ADMIN';
              return (
                <div
                  key={c.id}
                  className="group flex items-start gap-4 px-4 py-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:bg-slate-800/70 hover:border-slate-700/70 transition-all duration-150"
                >
                  {/* Avatar */}
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-extrabold shrink-0 select-none
                    ${isAuthorAdmin
                      ? 'bg-rose-500/25 text-rose-300 ring-1 ring-rose-500/30'
                      : 'bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-500/30'
                    }`}
                  >
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-[14px] text-white leading-none">
                        {c.author?.name}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider
                        ${isAuthorAdmin
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {c.author?.role}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {formatFriendlyTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-[14px] text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                      {cleanCommentContent(c.content)}
                    </p>
                  </div>

                  {/* Delete */}
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer shrink-0"
                      title="Delete Comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="px-5 py-4 bg-slate-900/70 border-t border-slate-800/70">
          <form
            onSubmit={handlePostComment}
            className={`flex items-center gap-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl px-4 py-2 focus-within:ring-2 ${colors.ring} focus-within:border-slate-600 transition-all`}
          >
            <textarea
              rows={1}
              required
              placeholder={`Message in ${getDiscussionTitle()}...`}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 text-[14px] py-2.5 bg-transparent outline-none border-none resize-none
                text-slate-100
                placeholder:text-slate-600
                max-h-24 overflow-y-auto leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handlePostComment(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className={`h-10 shrink-0 rounded-xl px-5 ${colors.icon.replace('text-', 'bg-').replace('accent', 'accent').replace('text-amber-400', 'bg-amber-500').replace('text-rose-400', 'bg-rose-500')} bg-accent text-white text-[13px] font-extrabold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`}
            >
              {submitting ? 'Sending…' : 'Send'}
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
          <p className="text-[11px] text-slate-600 font-medium mt-2 pl-1">
            <kbd className="px-1 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">Enter</kbd> to send ·{' '}
            <kbd className="px-1 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">Shift+Enter</kbd> for newline
          </p>
        </div>
      </div>
    </div>
  );
}
