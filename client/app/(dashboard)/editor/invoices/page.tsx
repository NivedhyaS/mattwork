'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  FileText, 
  Download, 
  Loader2, 
  AlertCircle, 
  Calendar,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { formatEditorCurrency, formatDate } from '@/lib/utils';
import Button from '@/components/ui/button';

interface Project {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

export default function EditorInvoicesPage() {
  const [completedProjects, setCompletedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratePerVideo, setRatePerVideo] = useState(500);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate last 6 months dropdown list
  const getMonthsList = () => {
    const list = [];
    const date = new Date();
    for (let i = 0; i < 6; i++) {
      const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      list.push(monthName);
      date.setMonth(date.getMonth() - 1);
    }
    return list;
  };

  const months = getMonthsList();

  useEffect(() => {
    if (months.length > 0) {
      setSelectedMonth(months[0]);
    }

    Promise.all([
      api.get('/projects?limit=100'),
      api.get('/editors/me'),
    ])
      .then(([projectsRes, editorRes]) => {
        const data: Project[] = projectsRes.data.data;
        // completed projects
        setCompletedProjects(data.filter(p => p.status === 'UPLOADED'));
        
        const profile = editorRes.data.data;
        if (profile?.hourlyRate) {
          setRatePerVideo(Number(profile.hourlyRate));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleGenerateInvoice = async () => {
    if (!selectedMonth) return;
    setIsGenerating(true);
    try {
      const response = await api.get(`/invoices/editor/pdf?month=${encodeURIComponent(selectedMonth)}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `editor_invoice_${selectedMonth.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Invoice generation failed:', err);
      alert('Failed to generate payout invoice statement.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-[36px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="h-7 w-7 text-accent" />
          Editor Payout Statements
        </h1>
        <p className="text-[15px] text-slate-500 mt-2">
          Select a production month to compile completed projects and generate your invoice payout PDF.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 flat-card bg-card border border-border">
          <Loader2 className="h-6 w-6 animate-spin text-slate-350" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Action Card */}
          <div className="flat-card bg-card p-5 border border-border space-y-4 md:col-span-1">
            <h3 className="font-bold text-[15px] text-slate-800 dark:text-slate-200">Compile Statement</h3>
            
            <div className="space-y-2">
              <label className="text-[12px] text-slate-400 font-bold uppercase tracking-wider block">Target Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full text-[14px] border border-border rounded-lg p-2.5 bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {months.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/30 p-3.5 rounded-lg border border-border">
              <span className="text-[12px] text-slate-400 block font-bold uppercase">Est. project rate</span>
              <span className="font-bold text-[15px] text-slate-800 dark:text-white">
                {formatEditorCurrency(ratePerVideo)} / video
              </span>
            </div>

            <Button
              onClick={handleGenerateInvoice}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 bg-accent text-white font-semibold cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download Payout PDF
                </>
              )}
            </Button>
          </div>

          {/* Completed work summary */}
          <div className="flat-card bg-card p-5 border border-border space-y-4 md:col-span-2">
            <h3 className="font-bold text-[15px] text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-status-green" />
              All Completed Deliverables ({completedProjects.length})
            </h3>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {completedProjects.length === 0 ? (
                <div className="text-center py-10 text-slate-450">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                  <p>No completed projects found in database.</p>
                </div>
              ) : (
                completedProjects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 border border-border rounded-xl hover:border-slate-350 dark:hover:border-slate-750 transition-colors">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-[15px] text-slate-850 dark:text-slate-100">{p.title}</p>
                      <div className="flex items-center gap-2 text-[13px] text-slate-400">
                        <Calendar className="h-3.5 w-3.5" />
                        Completed: {new Date(p.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-[15px] text-slate-800 dark:text-slate-200">
                        {formatEditorCurrency(ratePerVideo)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
