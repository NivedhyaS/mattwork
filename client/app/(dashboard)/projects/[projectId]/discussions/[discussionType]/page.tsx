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
  FileVideo
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

function formatShortTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function isSameSenderGroup(c1: any, c2: any): boolean {
  if (!c1 || !c2) return false;
  if (c1.author?.id !== c2.author?.id) return false;
  const t1 = new Date(c1.createdAt).getTime();
  const t2 = new Date(c2.createdAt).getTime();
  return Math.abs(t2 - t1) < 5 * 60 * 1000; // within 5 minutes
}

// Returns accent color tokens per discussion type
function getDiscussionColors(discussionType: string) {
  if (discussionType === 'revision-1') return {
    icon: 'text-amber-400',
    iconBg: 'bg-amber-500/15 border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    ring: 'focus-within:ring-amber-500/40',
    btnBg: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold',
  };
  if (discussionType === 'revision-2') return {
    icon: 'text-rose-400',
    iconBg: 'bg-rose-500/15 border-rose-500/30',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    ring: 'focus-within:ring-rose-500/40',
    btnBg: 'bg-rose-500 hover:bg-rose-400 text-white font-bold',
  };
  return {
    icon: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15 border-indigo-500/30',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    ring: 'focus-within:ring-indigo-500/40',
    btnBg: 'bg-indigo-500 hover:bg-indigo-400 text-white font-bold',
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
    setActiveTimestampToast(`Jumping to ${ts} in video player...`);
    setTimeout(() => setActiveTimestampToast(null), 3000);
  };

  const insertChip = (chipText: string) => {
    setNewComment((prev) => (prev ? `${prev} ${chipText}` : chipText));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        <p className="text-sm font-semibold text-slate-400">Loading conversation...</p>
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

  const renderBubbleContent = (content: string, isResolved: boolean) => {
    const cleaned = cleanCommentContent(content);
    const lines = cleaned.split('\n');

    const timestampRegex = /(:\d{2}(?:-\:\d{2})?|\b\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\b)/g;

    return (
      <div className={`space-y-1 ${isResolved ? 'opacity-50 line-through' : ''}`}>
        {lines.map((line, lIdx) => {
          const parts = line.split(timestampRegex);
          return (
            <p key={lIdx} className="text-[14.5px] leading-relaxed font-medium text-slate-100">
              {parts.map((part, pIdx) => {
                if (part.match(/^(:\d{2}(?:-\:\d{2})?|\b\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\b)$/)) {
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handleTimestampClick(part)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-[12px] font-bold transition-all cursor-pointer shadow-xs"
                      title="Click to jump in video player"
                    >
                      <Clock className="h-3 w-3 text-amber-400" />
                      {part}
                    </button>
                  );
                }
                return part;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 px-4 sm:px-6 pb-8">
      {/* Toast Notification */}
      {activeTimestampToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 border border-amber-500/50 text-amber-300 text-[13px] font-bold rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3">
          <FileVideo className="h-4 w-4 text-amber-400 animate-bounce" />
          <span>{activeTimestampToast}</span>
        </div>
      )}

      {/* Slack/Discord Style Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-3.5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
            title="Back to board"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-extrabold text-white tracking-tight">
                #{getDiscussionTitle()}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${colors.badge}`}>
                {discussionType}
              </span>
            </div>
            <p className="text-[12px] text-slate-400 font-medium">
              {project.standardName} · <span className="text-slate-500">{filteredComments.length} messages</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleBack}
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-[12px] font-bold transition-all cursor-pointer"
        >
          <FolderKanban className="h-3.5 w-3.5 text-slate-400" />
          <span>Board</span>
        </button>
      </div>

      {/* Main Conversation Container */}
      <div className="bg-slate-950/80 border border-slate-800/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[76vh]">

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2 min-h-[160px] custom-scrollbar">
          {filteredComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className={`h-14 w-14 rounded-2xl border ${colors.iconBg} flex items-center justify-center`}>
                <MessageSquare className={`h-6 w-6 ${colors.icon} stroke-[1.5]`} />
              </div>
              <p className="text-[16px] font-bold text-slate-200">Start of #{getDiscussionTitle()}</p>
              <p className="text-[13px] font-medium text-slate-500 max-w-sm">
                This is the beginning of the timestamped revision channel for {project.standardName}.
              </p>
            </div>
          ) : (
            filteredComments.map((c, idx) => {
              const prevComment = idx > 0 ? filteredComments[idx - 1] : null;
              const sameSender = isSameSenderGroup(prevComment, c);
              const initials = getInitials(c.author?.name || 'User');
              const isAuthorAdmin = c.author?.role === 'ADMIN';
              const isResolved = !!resolvedIds[c.id];
              const reactionCount = reactions[c.id] || 0;

              return (
                <div
                  key={c.id}
                  className={`group relative flex items-start gap-3 transition-all duration-150 ${
                    sameSender ? 'mt-1 pl-11' : 'mt-3.5'
                  }`}
                >
                  {/* Avatar (only shown when sender changes) */}
                  {!sameSender && (
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 select-none shadow-xs mt-0.5
                        ${isAuthorAdmin
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        }`}
                    >
                      {initials}
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Header line (only for first message in group) */}
                    {!sameSender && (
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[13.5px] text-slate-100">
                          {c.author?.name}
                        </span>
                        <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider
                          ${isAuthorAdmin
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {c.author?.role}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {formatFriendlyTime(c.createdAt)}
                        </span>
                      </div>
                    )}

                    {/* Chat Bubble */}
                    <div
                      className={`relative inline-block max-w-full sm:max-w-[85%] rounded-2xl px-4 py-2.5 transition-all ${
                        isAuthorAdmin
                          ? 'bg-slate-900/90 border border-slate-800/80 shadow-xs'
                          : 'bg-slate-900/60 border border-slate-800/60 shadow-xs'
                      } ${isResolved ? 'opacity-50' : 'hover:border-slate-700/80'}`}
                    >
                      {renderBubbleContent(c.content, isResolved)}

                      {/* Reactions / Resolved Badges inside bubble */}
                      {(reactionCount > 0 || isResolved) && (
                        <div className="flex items-center gap-1.5 mt-2 pt-1 border-t border-slate-800/60">
                          {isResolved && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Resolved
                            </span>
                          )}
                          {reactionCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-700">
                              👍 {reactionCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Hover Timestamp for grouped messages */}
                    {sameSender && (
                      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-500 ml-2 transition-opacity">
                        {formatShortTime(c.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* Hover Floating Actions (Slack/WhatsApp style) */}
                  <div className="absolute right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/95 border border-slate-700/80 rounded-xl p-1 shadow-xl backdrop-blur-md z-10">
                    <button
                      onClick={() => toggleResolve(c.id)}
                      className={`p-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                        isResolved
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                      title={isResolved ? 'Mark Unresolved' : 'Mark Resolved'}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleAddReaction(c.id)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                      title="React 👍"
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => insertChip(`Replying to @${c.author?.name}: `)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                      title="Reply"
                    >
                      <CornerDownRight className="h-3.5 w-3.5" />
                    </button>

                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete message"
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

        {/* Minimal Bottom Composer Bar */}
        <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800/80 space-y-2">
          {/* Suggestion Chips Above Input */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[12px]">
            <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider shrink-0 mr-1">Quick Notes:</span>
            <button
              type="button"
              onClick={() => insertChip(':07 ')}
              className="px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1"
            >
              <Clock className="h-3 w-3 text-amber-400" /> :07
            </button>
            <button
              type="button"
              onClick={() => insertChip(':20-:31 ')}
              className="px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1"
            >
              <Clock className="h-3 w-3 text-amber-400" /> :20-:31
            </button>
            <button
              type="button"
              onClick={() => insertChip('[Tighten Cut] ')}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-medium transition-all cursor-pointer shrink-0"
            >
              [Tighten Cut]
            </button>
            <button
              type="button"
              onClick={() => insertChip('[Color Grade] ')}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-medium transition-all cursor-pointer shrink-0"
            >
              [Color Grade]
            </button>
            <button
              type="button"
              onClick={() => insertChip('[Audio Level] ')}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-medium transition-all cursor-pointer shrink-0"
            >
              [Audio Level]
            </button>
          </div>

          {/* Minimal Input Bar */}
          <form
            onSubmit={handlePostComment}
            className={`flex items-center gap-2.5 bg-slate-950/90 border border-slate-800 rounded-2xl px-3.5 py-2 focus-within:ring-2 ${colors.ring} focus-within:border-slate-700 transition-all`}
          >
            <button
              type="button"
              onClick={() => alert('Attachment upload ready.')}
              className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Attach reference"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <textarea
              rows={1}
              required
              placeholder={`Message #${getDiscussionTitle()}...`}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 text-[14.5px] py-1 bg-transparent outline-none border-none resize-none
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
              className={`h-9 shrink-0 rounded-xl px-4 ${colors.btnBg} flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-30 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer`}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="text-[13px]">Send</span>
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
              <Eye className="h-3 w-3 text-slate-500" /> Synced with Video Player
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
