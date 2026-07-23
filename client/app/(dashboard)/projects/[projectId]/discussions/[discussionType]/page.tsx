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
  Clock,
  CheckCircle2,
  Paperclip,
  Smile,
  CornerDownRight,
  Eye,
  FileVideo,
  CheckCheck
} from 'lucide-react';

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
    iconBg: 'bg-amber-500/15 border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    ring: 'focus-within:ring-amber-500/40',
    btnBg: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold',
    borderLeft: 'border-l-amber-500',
    cardBg: 'bg-amber-500/5 border-amber-500/20',
  };
  if (discussionType === 'revision-2') return {
    icon: 'text-rose-400',
    iconBg: 'bg-rose-500/15 border-rose-500/30',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    ring: 'focus-within:ring-rose-500/40',
    btnBg: 'bg-rose-500 hover:bg-rose-400 text-white font-bold',
    borderLeft: 'border-l-rose-500',
    cardBg: 'bg-rose-500/5 border-rose-500/20',
  };
  return {
    icon: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15 border-indigo-500/30',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    ring: 'focus-within:ring-indigo-500/40',
    btnBg: 'bg-indigo-500 hover:bg-indigo-400 text-white font-bold',
    borderLeft: 'border-l-indigo-500',
    cardBg: 'bg-indigo-500/5 border-indigo-500/20',
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
  const [resolvedIds, setResolvedIds] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [activeTimestampToast, setActiveTimestampToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const getDiscussionKey = () => {
    if (discussionType === 'revision-2') return 'REVISION_2';
    if (discussionType === 'revision-1') return 'REVISION_1';
    return 'GENERAL';
  };

  const getDiscussionTitle = () => {
    if (discussionType === 'revision-2') return 'Revision 2 Notes';
    if (discussionType === 'revision-1') return 'Revision 1 Notes';
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

  const toggleResolve = (commentId: string) => {
    setResolvedIds((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const handleAddReaction = (commentId: string) => {
    setReactions((prev) => ({ ...prev, [commentId]: (prev[commentId] || 0) + 1 }));
  };

  const handleTimestampClick = (ts: string) => {
    setActiveTimestampToast(`Jumping to ${ts} in video player preview...`);
    setTimeout(() => setActiveTimestampToast(null), 3500);
  };

  const insertQuickTag = (tag: string) => {
    setNewComment((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        <p className="text-sm font-semibold text-slate-400">Loading revision thread...</p>
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

  const renderCommentBody = (content: string, isResolved: boolean) => {
    const cleaned = cleanCommentContent(content);
    const lines = cleaned.split('\n');

    return (
      <div className={`space-y-1.5 ${isResolved ? 'opacity-50 line-through' : ''}`}>
        {lines.map((line, lIdx) => {
          const timestampRegex = /(:\d{2}(?:-\:\d{2})?|\b\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\b)/g;
          const hasTimestamps = line.match(timestampRegex);

          if (!hasTimestamps) {
            return (
              <p key={lIdx} className="text-[14.5px] text-slate-200 leading-relaxed font-medium">
                {line}
              </p>
            );
          }

          const parts = line.split(timestampRegex);
          return (
            <div key={lIdx} className="flex flex-wrap items-center gap-1.5 my-1 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
              {parts.map((part, pIdx) => {
                if (part.match(/^(:\d{2}(?:-\:\d{2})?|\b\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\b)$/)) {
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handleTimestampClick(part)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-[12px] font-bold transition-all cursor-pointer shadow-xs"
                      title="Click to jump to video timestamp"
                    >
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      {part}
                    </button>
                  );
                }
                return (
                  <span key={pIdx} className="text-[14px] font-semibold text-slate-100">
                    {part}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 sm:px-6 pb-12">
      {/* Toast Notification for Timestamps */}
      {activeTimestampToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 border border-amber-500/50 text-amber-300 text-[13px] font-bold rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3">
          <FileVideo className="h-4 w-4 text-amber-400 animate-bounce" />
          <span>{activeTimestampToast}</span>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-1">
          {/* Single Unified Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px] text-slate-400 font-medium">
            <button
              onClick={handleBack}
              className="hover:text-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer font-semibold"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              Projects
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-slate-300 font-bold max-w-[200px] truncate">{project.standardName}</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-amber-400 font-bold">{getDiscussionTitle()}</span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <h1 className="text-[26px] font-extrabold text-white tracking-tight">
              {getDiscussionTitle()}
            </h1>
            <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-xl border ${colors.badge}`}>
              {discussionType}
            </span>
          </div>
        </div>

        {/* Clear Secondary Back Button */}
        <button
          onClick={handleBack}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700/80 hover:border-amber-500/40 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white text-[13px] font-bold transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400" />
          Back to Board
        </button>
      </div>

      {/* Main Thread & Composer Card */}
      <div className="bg-slate-950/90 border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

        {/* Subheader Toolbar */}
        <div className="px-6 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-xl border ${colors.iconBg} flex items-center justify-center shrink-0`}>
              <MessageSquare className={`h-4 w-4 ${colors.icon}`} />
            </div>
            <div>
              <span className="text-[14px] font-bold text-slate-100 tracking-wide">
                {project.standardName}
              </span>
              <p className="text-[11.5px] text-slate-400 font-medium mt-0.5">
                {filteredComments.length} revision note{filteredComments.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-400">
            <CheckCheck className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">Syncing with Video Player</span>
          </div>
        </div>

        {/* Message Thread Scroll Area */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-[160px] max-h-[52vh]">
          {filteredComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className={`h-14 w-14 rounded-2xl border ${colors.iconBg} flex items-center justify-center`}>
                <MessageSquare className={`h-6 w-6 ${colors.icon} stroke-[1.5]`} />
              </div>
              <p className="text-[16px] font-bold text-slate-200">No revision notes yet</p>
              <p className="text-[13.5px] font-medium text-slate-500 max-w-sm">
                Add timestamped notes below to give feedback on cuts, transitions, or audio.
              </p>
            </div>
          ) : (
            filteredComments.map((c) => {
              const initials = getInitials(c.author?.name || 'User');
              const isAuthorAdmin = c.author?.role === 'ADMIN';
              const isResolved = !!resolvedIds[c.id];
              const reactionCount = reactions[c.id] || 0;

              return (
                <div
                  key={c.id}
                  className={`group relative flex items-start gap-4 px-4.5 py-4 rounded-2xl border transition-all duration-200 ${
                    isAuthorAdmin
                      ? 'bg-slate-900/60 border-amber-500/20 border-l-4 border-l-amber-500'
                      : 'bg-slate-900/40 border-indigo-500/20 border-l-4 border-l-indigo-500'
                  } ${isResolved ? 'bg-slate-950/40 border-slate-800/60' : 'hover:border-slate-700/80'}`}
                >
                  {/* Avatar */}
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-extrabold shrink-0 select-none shadow-xs
                    ${isAuthorAdmin
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    }`}
                  >
                    {initials}
                  </div>

                  {/* Message Body */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[14.5px] text-white leading-none">
                          {c.author?.name}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider
                          ${isAuthorAdmin
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {c.author?.role}
                        </span>
                        <span className="text-[11.5px] text-slate-400 font-medium">
                          {formatFriendlyTime(c.createdAt)}
                        </span>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2">
                        {isResolved && (
                          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Resolved
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Formatted Content */}
                    {renderCommentBody(c.content, isResolved)}

                    {/* Reaction Pills */}
                    {reactionCount > 0 && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] font-bold text-amber-300">
                          👍 {reactionCount}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Bar (Hover Overlay) */}
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 shadow-lg backdrop-blur-xs">
                    <button
                      onClick={() => toggleResolve(c.id)}
                      className={`p-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                        isResolved
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                      title={isResolved ? 'Mark as Unresolved' : 'Mark as Resolved'}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleAddReaction(c.id)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                      title="Acknowledge / React"
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => insertQuickTag(`Replying to @${c.author?.name}: `)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                      title="Reply to message"
                    >
                      <CornerDownRight className="h-3.5 w-3.5" />
                    </button>

                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete Comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer & Toolbar */}
        <div className="px-5 py-4 bg-slate-900/90 border-t border-slate-800/80 space-y-2.5">
          {/* Quick Helper Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] mr-1">Quick Tools:</span>
              <button
                type="button"
                onClick={() => insertQuickTag(':07 ')}
                className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Clock className="h-3 w-3" /> :07
              </button>
              <button
                type="button"
                onClick={() => insertQuickTag(':20-:31 ')}
                className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Clock className="h-3 w-3" /> :20-:31
              </button>
              <button
                type="button"
                onClick={() => insertQuickTag('[Tighten Cut] ')}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-medium transition-all cursor-pointer"
              >
                [Tighten Cut]
              </button>
              <button
                type="button"
                onClick={() => insertQuickTag('[Color Grade] ')}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-medium transition-all cursor-pointer"
              >
                [Color Grade]
              </button>
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              <button
                type="button"
                onClick={() => alert('Attachment upload ready.')}
                className="p-1 hover:text-white transition-colors cursor-pointer"
                title="Attach reference file"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </div>
          </div>

          <form
            onSubmit={handlePostComment}
            className={`flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 focus-within:ring-2 ${colors.ring} focus-within:border-slate-700 transition-all`}
          >
            <textarea
              rows={1}
              required
              placeholder={`Write revision notes for ${getDiscussionTitle()}...`}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 text-[14.5px] py-2 bg-transparent outline-none border-none resize-none
                text-slate-100 placeholder:text-slate-500
                max-h-24 overflow-y-auto leading-relaxed font-medium"
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
              className={`h-10 shrink-0 rounded-xl px-5 ${colors.btnBg} flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-40 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer`}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
            <span>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">Enter</kbd> to send ·{' '}
              <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">Shift+Enter</kbd> for newline
            </span>
            <span className="text-slate-600 flex items-center gap-1">
              <Eye className="h-3 w-3 text-slate-500" /> Seen by Editor & Admin
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
