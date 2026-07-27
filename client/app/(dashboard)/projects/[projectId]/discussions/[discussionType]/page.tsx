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
  FolderKanban,
  Clock,
  CheckCircle2,
  Paperclip,
  Smile,
  CornerDownRight,
  Eye,
  FileVideo,
  Scissors,
  Sparkles,
  Volume2,
  X,
  FileText,
} from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Toast from '@/components/ui/Toast';

function getAvailableTabs(status: string, commentsList: any[]): string[] {
  const tabs = ['GENERAL'];
  const hasRevision1Comments = commentsList.some(c => c.content?.startsWith('[Revision 1] '));
  const hasRevision2Comments = commentsList.some(c => c.content?.startsWith('[Revision 2] '));
  const hasRevision3Comments = commentsList.some(c => c.content?.startsWith('[Revision 3] '));

  const isAtOrAfterRevision1 = [
    'REVISION_1', 'REVISION_1_REVIEW', 'REVISION_2',
    'REVISION_2_REVIEW', 'REVISION_3', 'REVISION_3_REVIEW', 'FINAL_DRAFT', 'UPLOADED'
  ].includes(status) || hasRevision1Comments;

  if (isAtOrAfterRevision1) tabs.push('REVISION_1');

  const isAtOrAfterRevision2 = [
    'REVISION_2', 'REVISION_2_REVIEW', 'REVISION_3', 'REVISION_3_REVIEW', 'FINAL_DRAFT', 'UPLOADED'
  ].includes(status) || hasRevision2Comments;

  if (isAtOrAfterRevision2) tabs.push('REVISION_2');

  const enteredRevision3 = ['REVISION_3', 'REVISION_3_REVIEW'].includes(status) || hasRevision3Comments;
  if (enteredRevision3) tabs.push('REVISION_3');

  return tabs;
}

function cleanCommentContent(content: string): string {
  if (content?.startsWith('[Revision 1] ')) return content.slice('[Revision 1] '.length);
  if (content?.startsWith('[Revision 2] ')) return content.slice('[Revision 2] '.length);
  if (content?.startsWith('[Revision 3] ')) return content.slice('[Revision 3] '.length);
  return content;
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
    icon: 'text-[#F59E0B]',
    badge: 'bg-[#D8CFC2] text-[#F59E0B] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]',
  };
  if (discussionType === 'revision-2') return {
    icon: 'text-[#EF4444]',
    badge: 'bg-[#D8CFC2] text-[#EF4444] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]',
  };
  if (discussionType === 'revision-3') return {
    icon: 'text-[#EC4899]',
    badge: 'bg-[#D8CFC2] text-[#EC4899] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]',
  };
  return {
    icon: 'text-[#EA580C]',
    badge: 'bg-[#D8CFC2] text-[#EA580C] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]',
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

  // Attachment upload states
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string; type: string; url?: string } | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Non-blocking toast state
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);

  // Delete comment confirmation modal state
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const getDiscussionKey = () => {
    if (discussionType === 'revision-3') return 'REVISION_3';
    if (discussionType === 'revision-2') return 'REVISION_2';
    if (discussionType === 'revision-1') return 'REVISION_1';
    return 'GENERAL';
  };

  const getDiscussionTitle = () => {
    if (discussionType === 'revision-3') return 'Revision 3 Notes';
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

  // Handle File Selection & Validation
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max file size: 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setToast({ message: 'File size exceeds 50MB limit.', type: 'error' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const formattedSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      const formData = new FormData();
      formData.append('file', file);

      let fileUrl = '';
      try {
        const res = await api.post(`/projects/${projectId}/files`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        fileUrl = res.data?.data?.url || '';
      } catch {
        fileUrl = URL.createObjectURL(file);
      }

      setAttachedFile({
        name: file.name,
        size: formattedSize,
        type: file.type,
        url: fileUrl,
      });

      setToast({ message: `Attachment ready: "${file.name}" (${formattedSize})`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to upload attachment — please try again.', type: 'error' });
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && !attachedFile) || submitting || !project) return;
    setSubmitting(true);
    try {
      let finalContent = newComment.trim();
      if (attachedFile) {
        finalContent += `${finalContent ? '\n\n' : ''}📎 Attachment: ${attachedFile.name} (${attachedFile.size})`;
      }

      const activeKey = getDiscussionKey();
      if (activeKey === 'REVISION_1') finalContent = `[Revision 1] ${finalContent}`;
      else if (activeKey === 'REVISION_2') finalContent = `[Revision 2] ${finalContent}`;

      const res = await api.post(`/projects/${projectId}/comments`, { content: finalContent });
      setComments((prev) => [...prev, res.data.data]);
      setNewComment('');
      setAttachedFile(null);
      setToast({ message: 'Message posted.', type: 'success' });
    } catch (err) {
      console.error('Failed to submit comment:', err);
      setToast({ message: 'Failed to post message. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteComment = async () => {
    if (!deleteCommentId || user?.role !== 'ADMIN') return;
    setIsDeletingComment(true);
    try {
      await api.delete(`/projects/${projectId}/comments/${deleteCommentId}`);
      setComments((prev) => prev.filter((c) => c.id !== deleteCommentId));
      setToast({ message: 'Comment deleted successfully.', type: 'success' });
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setToast({ message: 'Failed to delete comment.', type: 'error' });
    } finally {
      setIsDeletingComment(false);
      setDeleteCommentId(null);
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
        <Loader2 className="h-8 w-8 animate-spin text-[#EA580C]" />
        <p className="text-sm font-extrabold text-[#4A3E34]">Loading conversation...</p>
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

  const renderBubbleText = (content: string, isResolved: boolean) => {
    const cleaned = cleanCommentContent(content);
    const lines = cleaned.split('\n');
    const timestampRegex = /(:\d{2}(?:-\:\d{2})?|\b\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\b)/g;

    return (
      <div className={`space-y-1 ${isResolved ? 'opacity-50 line-through' : ''}`}>
        {lines.map((line, lIdx) => {
          if (line.startsWith('📎 Attachment:')) {
            return (
              <div key={lIdx} className="mt-2 p-2.5 rounded-xl bg-[#D8CFC2] text-[#1F1610] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.85)] flex items-center gap-2 font-extrabold text-[13px]">
                <FileText className="h-4 w-4 text-[#EA580C] shrink-0" />
                <span className="truncate">{line}</span>
              </div>
            );
          }

          const parts = line.split(timestampRegex);
          return (
            <p key={lIdx} className="text-[14.5px] leading-relaxed font-semibold text-[#1F1610]">
              {parts.map((part, pIdx) => {
                if (part.match(/^(:\d{2}(?:-\:\d{2})?|\b\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\b)$/)) {
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handleTimestampClick(part)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 mx-1 rounded-2xl bg-[#D8CFC2] text-[#EA580C] hover:text-[#EA580C] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(135,120,108,0.6)] active:shadow-[inset_2px_2px_4px_rgba(135,120,108,0.6)] text-[12px] font-extrabold transition-all cursor-pointer"
                      title="Click to jump to video timestamp"
                    >
                      <Clock className="h-3.5 w-3.5 text-[#EA580C]" />
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
    <div className="max-w-5xl mx-auto flex flex-col min-h-[calc(100vh-80px)] px-4 sm:px-6">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Delete Comment Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteCommentId}
        onClose={() => setDeleteCommentId(null)}
        onConfirm={confirmDeleteComment}
        title="Delete Comment?"
        description="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete Comment"
        isLoading={isDeletingComment}
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept="image/*,video/*,.pdf,.doc,.docx,.zip,.txt"
        className="hidden"
      />

      {/* Timestamp Toast Notification */}
      {activeTimestampToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 bg-[#D8CFC2] text-[#EA580C] text-[13px] font-extrabold rounded-2xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.9),6px_6px_14px_rgba(135,120,108,0.65)] animate-in slide-in-from-top-3">
          <FileVideo className="h-4.5 w-4.5 text-[#EA580C] animate-bounce" />
          <span>{activeTimestampToast}</span>
        </div>
      )}

      {/* Minimal Top Header Line */}
      <div className="sticky top-0 z-20 bg-[#D8CFC2]/95 backdrop-blur-md border-b border-[rgba(135,120,108,0.4)] py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-2xl bg-[#D8CFC2] text-[#4A3E34] hover:text-[#EA580C] shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(135,120,108,0.6)] transition-all cursor-pointer"
            title="Back to board"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="text-[20px] font-extrabold text-[#1F1610] tracking-tight">
              #{getDiscussionTitle()}
            </span>
            <span className={`text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-xl ${colors.badge}`}>
              {discussionType}
            </span>
            <span className="text-[13px] text-[#4A3E34] font-bold hidden sm:inline">
              • {project.standardName}
            </span>
          </div>
        </div>

        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4.5 py-2.5 rounded-2xl bg-[#D8CFC2] text-[#1F1610] hover:text-[#EA580C] shadow-[-4px_-4px_8px_rgba(255,255,255,0.9),4px_4px_8px_rgba(135,120,108,0.6)] hover:shadow-[-6px_-6px_12px_rgba(255,255,255,0.95),6px_6px_12px_rgba(135,120,108,0.75)] font-extrabold text-[13.5px] transition-all cursor-pointer"
        >
          <FolderKanban className="h-4 w-4 text-[#EA580C]" />
          <span>Board</span>
        </button>
      </div>

      {/* Natural Conversation Stream */}
      <div className="flex-1 py-6 space-y-4">
        {filteredComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center my-10 py-10 px-8 text-center gap-3.5 bg-[#D8CFC2] rounded-3xl shadow-[inset_4px_4px_8px_rgba(135,120,108,0.55),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] max-w-md mx-auto">
            <div className="h-14 w-14 rounded-2xl bg-[#D8CFC2] shadow-[-4px_-4px_8px_rgba(255,255,255,0.9),4px_4px_8px_rgba(135,120,108,0.6)] flex items-center justify-center">
              <MessageSquare className={`h-6 w-6 ${colors.icon}`} />
            </div>
            <p className="text-[17px] font-extrabold text-[#1F1610]">Start of #{getDiscussionTitle()}</p>
            <p className="text-[13px] font-semibold text-[#4A3E34] max-w-xs leading-relaxed">
              No notes added yet for <span className="text-[#1F1610]">{project.standardName}</span>. Use the composer below to share feedback.
            </p>
          </div>
        ) : (
          filteredComments.map((c, idx) => {
            const prevComment = idx > 0 ? filteredComments[idx - 1] : null;
            const sameSender = isSameSenderGroup(prevComment, c);
            const isAuthorAdmin = c.author?.role === 'ADMIN';
            const isSelf = c.author?.id === user?.id;
            const isResolved = !!resolvedIds[c.id];
            const reactionCount = reactions[c.id] || 0;

            return (
              <div
                key={c.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} ${sameSender ? 'mt-1' : 'mt-4'}`}
              >
                {!sameSender && (
                  <div className={`flex items-center gap-2 mb-1 px-1 ${isSelf ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[13px] font-extrabold text-[#1F1610]">
                      {c.author?.name}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-xl bg-[#D8CFC2] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] ${
                      isAuthorAdmin ? 'text-[#EA580C]' : 'text-[#1F1610]'
                    }`}>
                      {c.author?.role}
                    </span>
                    <span className="text-[11px] text-[#4A3E34] font-bold">
                      {formatFriendlyTime(c.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  className={`group relative max-w-[88%] sm:max-w-[65%] rounded-3xl px-5 py-3.5 transition-all ${
                    isSelf
                      ? 'bg-[#D8CFC2] text-[#1F1610] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(135,120,108,0.6)] border-l-4 border-l-[#EA580C] rounded-tr-xs'
                      : isAuthorAdmin
                        ? 'bg-[#D8CFC2] text-[#1F1610] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(135,120,108,0.6)] rounded-tl-xs'
                        : 'bg-[#D8CFC2] text-[#1F1610] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(135,120,108,0.6)] rounded-tl-xs'
                  } ${isResolved ? 'opacity-50' : ''}`}
                >
                  {renderBubbleText(c.content, isResolved)}

                  {(reactionCount > 0 || isResolved) && (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-1.5 border-t border-[rgba(135,120,108,0.4)]">
                      {isResolved && (
                        <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#D8CFC2] text-[#16A34A] shadow-[inset_2px_2px_4px_rgba(22,163,74,0.3)] flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Resolved
                        </span>
                      )}
                      {reactionCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D8CFC2] text-[11px] font-extrabold text-[#EA580C] shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                          👍 {reactionCount}
                        </span>
                      )}
                    </div>
                  )}

                  <div className={`absolute ${isSelf ? '-left-12' : '-right-12'} top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#D8CFC2] shadow-[-3px_-3px_6px_rgba(255,255,255,0.9),3px_3px_6px_rgba(135,120,108,0.6)] rounded-2xl p-1`}>
                    <button
                      onClick={() => toggleResolve(c.id)}
                      className={`p-1.5 rounded-xl text-[11px] font-bold transition-all ${
                        isResolved
                          ? 'text-[#16A34A]'
                          : 'text-[#4A3E34] hover:text-[#16A34A]'
                      }`}
                      title={isResolved ? 'Mark Unresolved' : 'Mark Resolved'}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleAddReaction(c.id)}
                      className="p-1.5 text-[#4A3E34] hover:text-[#EA580C] rounded-xl transition-all"
                      title="React 👍"
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => insertChip(`Replying to @${c.author?.name}: `)}
                      className="p-1.5 text-[#4A3E34] hover:text-[#EA580C] rounded-xl transition-all"
                      title="Reply"
                    >
                      <CornerDownRight className="h-3.5 w-3.5" />
                    </button>

                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => setDeleteCommentId(c.id)}
                        className="p-1.5 text-[#4A3E34] hover:text-[#EF4444] rounded-xl transition-all"
                        title="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Sticky Composer Bar */}
      <div className="sticky bottom-0 z-20 bg-[#D8CFC2]/95 backdrop-blur-xl border-t border-[rgba(135,120,108,0.4)] pt-3.5 pb-4 space-y-3">
        {/* Quick Tools Shortcuts Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 custom-scrollbar text-[12px]">
          <span className="text-[#4A3E34] font-extrabold uppercase text-[10px] tracking-wider shrink-0 mr-1">Quick Tools:</span>
          <button
            type="button"
            onClick={() => insertChip(':07 ')}
            className="px-3 py-1.5 rounded-2xl bg-[#D8CFC2] text-[#EA580C] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(135,120,108,0.6)] hover:shadow-[-3px_-3px_6px_rgba(255,255,255,0.95),3px_3px_6px_rgba(135,120,108,0.7)] active:shadow-[inset_2px_2px_4px_rgba(135,120,108,0.6)] font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Clock className="h-3.5 w-3.5 text-[#EA580C]" /> :07
          </button>
          <button
            type="button"
            onClick={() => insertChip(':20-:31 ')}
            className="px-3 py-1.5 rounded-2xl bg-[#D8CFC2] text-[#EA580C] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(135,120,108,0.6)] hover:shadow-[-3px_-3px_6px_rgba(255,255,255,0.95),3px_3px_6px_rgba(135,120,108,0.7)] active:shadow-[inset_2px_2px_4px_rgba(135,120,108,0.6)] font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Clock className="h-3.5 w-3.5 text-[#EA580C]" /> :20-:31
          </button>
          <button
            type="button"
            onClick={() => insertChip('[Tighten Cut] ')}
            className="px-3 py-1.5 rounded-2xl bg-[#D8CFC2] text-[#EA580C] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(135,120,108,0.6)] hover:shadow-[-3px_-3px_6px_rgba(255,255,255,0.95),3px_3px_6px_rgba(135,120,108,0.7)] active:shadow-[inset_2px_2px_4px_rgba(135,120,108,0.6)] font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Scissors className="h-3.5 w-3.5 text-[#EA580C]" /> [Tighten Cut]
          </button>
          <button
            type="button"
            onClick={() => insertChip('[Color Grade] ')}
            className="px-3 py-1.5 rounded-2xl bg-[#D8CFC2] text-[#EA580C] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(135,120,108,0.6)] hover:shadow-[-3px_-3px_6px_rgba(255,255,255,0.95),3px_3px_6px_rgba(135,120,108,0.7)] active:shadow-[inset_2px_2px_4px_rgba(135,120,108,0.6)] font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#EA580C]" /> [Color Grade]
          </button>
          <button
            type="button"
            onClick={() => insertChip('[Audio Level] ')}
            className="px-3 py-1.5 rounded-2xl bg-[#D8CFC2] text-[#EA580C] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(135,120,108,0.6)] hover:shadow-[-3px_-3px_6px_rgba(255,255,255,0.95),3px_3px_6px_rgba(135,120,108,0.7)] active:shadow-[inset_2px_2px_4px_rgba(135,120,108,0.6)] font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Volume2 className="h-3.5 w-3.5 text-[#EA580C]" /> [Audio Level]
          </button>
        </div>

        {/* Attached File Preview Chip */}
        {attachedFile && (
          <div className="flex items-center justify-between p-2.5 px-4 bg-[#D8CFC2] rounded-2xl shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.85)] border border-[rgba(234,88,12,0.3)] animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <Paperclip className="h-4 w-4 text-[#EA580C] shrink-0" />
              <span className="font-extrabold text-[13px] text-[#1F1610] truncate">{attachedFile.name}</span>
              <span className="text-[11px] font-extrabold text-[#4A3E34] bg-[#D8CFC2] px-2 py-0.5 rounded-full shadow-[inset_1px_1px_3px_rgba(135,120,108,0.4)] shrink-0">
                {attachedFile.size}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedFile(null)}
              className="p-1 rounded-xl text-[#4A3E34] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors cursor-pointer"
              title="Remove attachment"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Floating Composer Bar */}
        <form
          onSubmit={handlePostComment}
          className="flex items-center gap-3 bg-[#D8CFC2] rounded-2xl px-4 py-2.5 shadow-[inset_3px_3px_6px_rgba(135,120,108,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] transition-all focus-within:shadow-[inset_4px_4px_8px_rgba(135,120,108,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.9)]"
        >
          <button
            type="button"
            disabled={isUploadingAttachment}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-[#4A3E34] hover:text-[#EA580C] hover:bg-[#D8CFC2] hover:shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(135,120,108,0.6)] active:shadow-[inset_2px_2px_4px_rgba(135,120,108,0.6)] transition-all cursor-pointer shrink-0 disabled:opacity-50"
            title="Attach file (Max 50MB)"
          >
            {isUploadingAttachment ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin text-[#EA580C]" />
            ) : (
              <Paperclip className="h-4.5 w-4.5" />
            )}
          </button>

          <textarea
            rows={1}
            placeholder={`Message #${getDiscussionTitle()}...`}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 text-[14.5px] py-1 bg-transparent outline-none border-none resize-none
              text-[#1F1610] placeholder:text-[#4A3E34]
              max-h-24 overflow-y-auto leading-relaxed font-semibold"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handlePostComment(e);
              }
            }}
          />

          <button
            type="submit"
            disabled={submitting || (!newComment.trim() && !attachedFile)}
            className={`h-10 shrink-0 rounded-2xl px-5 font-extrabold flex items-center gap-2 transition-all shadow-md ${
              submitting || (!newComment.trim() && !attachedFile)
                ? 'bg-[#E0D5CB] text-[#4A3E34] shadow-none opacity-50 cursor-not-allowed pointer-events-none'
                : 'bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px_8px_rgba(234,88,12,0.4)] hover:scale-[1.02] active:scale-95 cursor-pointer'
            }`}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <>
                <span className="text-[13px]">Send</span>
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-[#4A3E34] font-semibold px-1">
          <span>
            <kbd className="px-2 py-0.5 rounded-lg text-[10px] bg-[#D8CFC2] text-[#1F1610] font-extrabold font-mono shadow-[inset_1px_1px_3px_rgba(135,120,108,0.5)]">Enter</kbd> to send ·{' '}
            <kbd className="px-2 py-0.5 rounded-lg text-[10px] bg-[#D8CFC2] text-[#1F1610] font-extrabold font-mono shadow-[inset_1px_1px_3px_rgba(135,120,108,0.5)]">Shift+Enter</kbd> for newline
          </span>
          <span className="text-[#1F1610] font-extrabold flex items-center gap-2 bg-[#D8CFC2] px-3 py-1 rounded-full shadow-[inset_2px_2px_4px_rgba(135,120,108,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Synced with Video Player</span>
          </span>
        </div>
      </div>
    </div>
  );
}
