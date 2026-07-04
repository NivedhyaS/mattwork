'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  DollarSign, 
  Video, 
  Clock, 
  Download, 
  ExternalLink, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Project {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  driveFolder: string | null;
  formLink: string | null;
  files: { url: string; fileType: string; filename: string }[];
}

const getClientStatus = (status: string) => {
  const s = status.toUpperCase();
  if (['NEW_VIDEO', 'PENDING'].includes(s)) return 'submitted';
  if (['EDITING', 'REVISION_1', 'REVISION_2', 'FINAL_DRAFT', 'IN_PROGRESS'].includes(s)) return 'in production';
  if (['EDITING_REVIEW', 'REVISION_1_REVIEW', 'REVISION_2_REVIEW', 'REVIEW'].includes(s)) return 'in review';
  if (['UPLOADED', 'COMPLETED'].includes(s)) return 'delivered';
  return 'inactive';
};

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-slate-50 text-slate-650 border-border',
  'in production': 'bg-status-amber/10 text-status-amber border-status-amber/20',
  'in review': 'bg-accent/10 text-accent border-accent/20',
  delivered: 'bg-status-green/10 text-status-green border-status-green/20',
  inactive: 'bg-slate-50 text-slate-500 border-border',
};

export default function ClientDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Dynamic balance states
  const [advancePaid, setAdvancePaid] = useState(0);
  const [completedWork, setCompletedWork] = useState(0);
  const [remainingCredit, setRemainingCredit] = useState(0);
  const [remainingVideos, setRemainingVideos] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get('/projects?limit=100'),
      api.get('/clients/me'),
    ])
      .then(async ([projectsRes, clientRes]) => {
        const projData = projectsRes.data.data;
        setProjects(projData);
        if (projData.length > 0) setSelectedProject(projData[0]);

        const clientProfile = clientRes.data.data;
        const fallbackCompleted = projData.filter((p: Project) => getClientStatus(p.status) === 'delivered').length * 1000;

        if (clientProfile?.id) {
          try {
            const balanceRes = await api.get(`/clients/${clientProfile.id}/balance`);
            const bal = balanceRes.data.data;
            setAdvancePaid(Number(bal.advancePaid));
            setCompletedWork(Number(bal.completedWorkValue));
            setRemainingCredit(Number(bal.remainingCredit));
            setRemainingVideos(Number(bal.equivalentRemainingVideos ?? 0));
          } catch (balErr) {
            console.error('Failed to load dynamic client balance:', balErr);
            setAdvancePaid(50000);
            setCompletedWork(fallbackCompleted);
            setRemainingCredit(50000 - fallbackCompleted);
            setRemainingVideos(Math.max(0, Math.floor((50000 - fallbackCompleted) / 1000)));
          }
        } else {
          setAdvancePaid(50000);
          setCompletedWork(fallbackCompleted);
          setRemainingCredit(50000 - fallbackCompleted);
          setRemainingVideos(Math.max(0, Math.floor((50000 - fallbackCompleted) / 1000)));
        }

        // Fetch each project details to compile client's invoices safely
        try {
          const detailPromises = projData.map((p: Project) => api.get(`/projects/${p.id}`));
          const detailsRes = await Promise.all(detailPromises);
          
          const allInvoicesMap = new Map<string, any>();
          detailsRes.forEach((res) => {
            const detailProj = res.data.data;
            if (detailProj.invoices && detailProj.invoices.length > 0) {
              detailProj.invoices.forEach((inv: any) => {
                allInvoicesMap.set(inv.id, inv);
              });
            }
          });
          setInvoices(Array.from(allInvoicesMap.values()));
        } catch (invoiceErr) {
          console.error('Failed to gather invoices from project details:', invoiceErr);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const finalFiles = selectedProject?.files?.filter(f => 
    f.fileType === 'VIDEO' || f.fileType === 'IMAGE'
  ) ?? [];

  // Derive client payment transaction history locally
  const paymentHistory = invoices
    .filter((inv) => inv.status === 'PAID' || Number(inv.amountPaid) > 0)
    .map((inv) => ({
      id: `PAY-${inv.id}`,
      invoiceNumber: inv.number,
      amount: inv.status === 'PAID' ? inv.total : inv.amountPaid,
      date: inv.paidAt || inv.updatedAt,
      method: 'Bank Transfer',
      status: 'Completed',
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-base">
      <div>
        <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
          Client dashboard
        </h1>
        <p className="text-[16px] text-slate-500 mt-2">
          Welcome back. Track your video production progress and credit balance.
        </p>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'advance paid', value: formatCurrency(advancePaid), icon: DollarSign, color: 'text-status-green', bg: 'bg-status-green/10' },
          { label: 'work completed', value: formatCurrency(completedWork), icon: CheckCircle2, color: 'text-accent', bg: 'bg-accent/10' },
          { label: 'remaining credit', value: formatCurrency(remainingCredit), icon: DollarSign, color: 'text-slate-900 dark:text-white', bg: 'bg-slate-100 dark:bg-slate-800' },
          { label: 'remaining videos', value: `${remainingVideos} videos`, icon: Video, color: 'text-slate-655', bg: 'bg-slate-100 dark:bg-slate-800' },
        ].map((stat) => (
          <div key={stat.label} className="flat-card bg-card p-6 border border-border">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[12px] uppercase font-bold text-slate-450 tracking-wider">{stat.label}</p>
                <h3 className="kpi-figure text-[38px] font-extrabold mt-2 text-slate-900 dark:text-white">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Projects Table & Invoices & Payments */}
        <div className="lg:col-span-2 space-y-8">
          {/* Projects */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Video className="h-5 w-5 text-slate-450" />
              Submitted videos
            </h2>
            <div className="flat-card bg-card border border-border overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Video className="h-10 w-10 mx-auto mb-3 text-slate-200" />
                  <p className="font-bold text-[15px]">No projects yet</p>
                  <p className="text-xs mt-1">Waiting on your first submission</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-border text-[12px] font-bold uppercase tracking-wider text-slate-450">
                        <th className="py-4 px-6">video title</th>
                        <th className="py-4 px-6">deadline</th>
                        <th className="py-4 px-6">status</th>
                        <th className="py-4 px-6 text-right">details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {projects.map((project) => {
                        const status = getClientStatus(project.status);
                        return (
                          <tr 
                            key={project.id} 
                            className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors cursor-pointer ${selectedProject?.id === project.id ? 'bg-slate-50/70 dark:bg-slate-900/20' : ''}`}
                            onClick={() => setSelectedProject(project)}
                          >
                            <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-200">{project.title}</td>
                            <td className="py-4 px-6 text-slate-550">
                              {project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`px-2.5 py-1 rounded border text-[11px] font-bold ${STATUS_COLORS[status] || STATUS_COLORS.inactive}`}>
                                {status}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedProject(project); }}
                                className="text-accent hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                view <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Invoice History */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-slate-455" />
              Invoice history
            </h2>
            <div className="flat-card bg-card border border-border overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="font-bold text-[15px]">No invoices found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-border text-[12px] font-bold uppercase tracking-wider text-slate-450">
                        <th className="py-4 px-6">invoice #</th>
                        <th className="py-4 px-6">amount</th>
                        <th className="py-4 px-6">status</th>
                        <th className="py-4 px-6">date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {invoices.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-200">{inv.number}</td>
                          <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">{formatCurrency(inv.total)}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 rounded border text-[11px] font-bold ${
                              inv.status === 'PAID' 
                                ? 'bg-status-green/10 text-status-green border-status-green/20' 
                                : 'bg-status-amber/10 text-status-amber border-status-amber/20'
                            }`}>
                              {inv.status.toLowerCase()}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-550">
                            {new Date(inv.createdAt).toLocaleDateString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="space-y-4">
            <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <CreditCard className="h-5 w-5 text-slate-450" />
              Payment history
            </h2>
            <div className="flat-card bg-card border border-border overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="font-bold text-[15px]">No completed payments found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[15px]">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-border text-[12px] font-bold uppercase tracking-wider text-slate-450">
                        <th className="py-4 px-6">transaction</th>
                        <th className="py-4 px-6">invoice #</th>
                        <th className="py-4 px-6">method</th>
                        <th className="py-4 px-6 text-right">amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paymentHistory.map((pay) => (
                        <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="py-4 px-6">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{pay.id}</p>
                            <span className="text-xs text-slate-400">{formatDate(pay.date)}</span>
                          </td>
                          <td className="py-4 px-6 text-slate-500 font-semibold">{pay.invoiceNumber}</td>
                          <td className="py-4 px-6 text-slate-500">{pay.method}</td>
                          <td className="py-4 px-6 font-bold text-slate-950 dark:text-white text-right">
                            {formatCurrency(pay.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Detail Panel */}
        <div className="space-y-4">
          <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-slate-450" />
            Project details
          </h2>

          {selectedProject ? (
            <div className="flat-card bg-card p-6 border border-border space-y-6">
              <div>
                <span className={`px-2.5 py-1 rounded border text-[11px] font-bold ${STATUS_COLORS[getClientStatus(selectedProject.status)] || ''}`}>
                  {getClientStatus(selectedProject.status)}
                </span>
                <h3 className="text-[18px] font-bold text-slate-900 dark:text-white mt-4 leading-tight">
                  {selectedProject.title}
                </h3>
              </div>

              {/* Progress Stepper */}
              <div className="py-4 border-t border-border border-b">
                <span className="text-[12px] font-bold text-slate-450 uppercase tracking-wider block mb-3.5">progress</span>
                <div className="flex justify-between items-center relative">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />
                  {['submitted', 'in production', 'in review', 'delivered'].map((step, index) => {
                    const currentStatus = getClientStatus(selectedProject.status);
                    const steps = ['submitted', 'in production', 'in review', 'delivered'];
                    const stepIndex = steps.indexOf(step);
                    const currentIndex = steps.indexOf(currentStatus);
                    
                    const isCompleted = stepIndex <= currentIndex;
                    const isCurrent = stepIndex === currentIndex;

                    return (
                      <div key={step} className="flex flex-col items-center z-10 relative">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center border text-[10px] font-bold ${
                          isCompleted
                            ? isCurrent ? 'bg-accent text-white border-accent' : 'bg-status-green text-white border-status-green'
                            : 'bg-white dark:bg-slate-950 text-slate-400 border-border'
                        }`}>
                          {stepIndex + 1}
                        </div>
                        <span className={`text-[10px] mt-2 font-bold whitespace-nowrap ${isCompleted ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Source materials */}
              <div className="space-y-3">
                <span className="text-[12px] font-bold text-slate-450 uppercase tracking-wider block">materials</span>
                {selectedProject.driveFolder && (
                  <a href={selectedProject.driveFolder} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-lg border border-border hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Video className="h-5 w-5 text-slate-450" />
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-slate-800 dark:text-slate-200 truncate">working drive folder</p>
                        <p className="text-xs text-slate-400 font-normal">google drive</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </a>
                )}
                {selectedProject.formLink && (
                  <a href={selectedProject.formLink} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-lg border border-border hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-slate-455" />
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-slate-800 dark:text-slate-200 truncate">script instructions</p>
                        <p className="text-xs text-slate-400 font-normal">google doc</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </a>
                )}
              </div>

              {/* Deliverables */}
              <div className="space-y-3 border-t border-border pt-4">
                <span className="text-[12px] font-bold text-slate-450 uppercase tracking-wider block">final deliverables</span>
                {getClientStatus(selectedProject.status) === 'delivered' && finalFiles.length > 0 ? (
                  <div className="space-y-2">
                    {finalFiles.map((file) => (
                      <a key={file.url} href={file.url} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between p-3.5 rounded-lg bg-status-green/5 border border-status-green/10 hover:bg-status-green/10 transition-colors text-status-green font-bold">
                        <div className="flex items-center gap-3 min-w-0">
                          {file.fileType === 'VIDEO' ? <Video className="h-4.5 w-4.5" /> : <ImageIcon className="h-4.5 w-4.5" />}
                          <p className="text-[14px] truncate max-w-[140px]">{file.filename}</p>
                        </div>
                        <Download className="h-4.5 w-4.5" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 text-center text-sm text-slate-400">
                    {getClientStatus(selectedProject.status) === 'delivered'
                      ? 'no files uploaded yet.'
                      : 'deliverables will appear here once editing is complete.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flat-card bg-card p-10 border border-border text-center text-slate-400 flex flex-col items-center justify-center min-h-[220px]">
              <Video className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold">No project selected</p>
              <p className="text-xs text-slate-450 mt-1 max-w-[170px]">Click a video to view details and download files.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
