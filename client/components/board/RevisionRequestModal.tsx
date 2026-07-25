'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { X, Clock, MessageSquare, Loader2, Paperclip } from 'lucide-react';
import Button from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Label from '@/components/ui/label';

interface RevisionRequestModalProps {
  isOpen: boolean;
  project: any;
  targetStage: string;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export default function RevisionRequestModal({ isOpen, project, targetStage, onClose, onSubmitSuccess }: RevisionRequestModalProps) {
  const [timecodes, setTimecodes] = useState('');
  const [generalComment, setGeneralComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !project) return null;

  const handleSubmit = async () => {
    if (!generalComment.trim() && !timecodes.trim()) {
      alert('Please provide at least a comment or timecode instruction.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/projects/${project.id}/revisions`, {
        stage: targetStage,
        rawClientInput: {
          timecodes: timecodes.trim(),
          generalComment: generalComment.trim()
        }
      });
      onSubmitSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to submit revision request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-orange-500" />
              Request {targetStage.replace('_', ' ')}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Submit your revision instructions for <span className="font-semibold text-slate-700 dark:text-slate-300">{project.title}</span></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Timecode Markers
            </Label>
            <textarea 
              value={timecodes}
              onChange={(e) => setTimecodes(e.target.value)}
              placeholder="e.g. 00:45 - Remove the logo&#10;01:20 - Make the text bigger"
              className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm resize-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              General Comments
            </Label>
            <textarea 
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
              placeholder="Overall thoughts on the video..."
              className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm resize-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400 flex items-start gap-3">
             <Paperclip className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
             <p>Your request will be sent to the Admin team for review before being forwarded to the editor. Please upload any required attachments directly to the project's Google Drive folder.</p>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="rounded-xl font-bold bg-white dark:bg-slate-900">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 border-0"
          >
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}
