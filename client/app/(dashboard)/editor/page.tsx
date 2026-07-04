"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  Briefcase, DollarSign, CheckCircle, Clock, Upload, 
  FileText, CheckSquare, Loader2
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Project {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  driveFolder: string | null;
  formLink: string | null;
}

interface EditorProfile {
  hourlyRate: number | null;
}

const getStatusLabel = (s: string) => s.replace(/_/g, " ").toLowerCase();

const STATUS_COLORS: Record<string, string> = {
  new_video: "bg-slate-50 text-slate-650 border-border",
  editing: "bg-status-amber/10 text-status-amber border-status-amber/20",
  editing_review: "bg-accent/10 text-accent border-accent/20",
  revision_1: "bg-status-amber/10 text-status-amber border-status-amber/20",
  revision_2: "bg-status-amber/10 text-status-amber border-status-amber/20",
  final_draft: "bg-status-amber/10 text-status-amber border-status-amber/20",
  uploaded: "bg-status-green/10 text-status-green border-status-green/20",
};

export default function EditorDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ratePerVideo, setRatePerVideo] = useState(500);

  const [completedCount, setCompletedCount] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get("/projects?limit=100"),
      api.get("/editors/me"),
    ])
      .then(async ([projectsRes, editorRes]) => {
        const data: Project[] = projectsRes.data.data;
        setProjects(data);
        if (data.length > 0) setSelectedProject(data[0]);
        
        const profile = editorRes.data.data;
        const fallbackRate = profile?.hourlyRate ? Number(profile.hourlyRate) : 500;
        setRatePerVideo(fallbackRate);

        if (profile?.id) {
          try {
            const earningsRes = await api.get(`/editors/${profile.id}/earnings`);
            const earnings = earningsRes.data.data;
            setCompletedCount(earnings.completedCount);
            setTotalEarnings(earnings.totalEarnings);
            setRatePerVideo(earnings.ratePerProject);
          } catch (err) {
            console.error("Failed to fetch editor earnings endpoint:", err);
            const localCompleted = data.filter(p => p.status === "UPLOADED").length;
            setCompletedCount(localCompleted);
            setTotalEarnings(localCompleted * fallbackRate);
          }
        } else {
          const localCompleted = data.filter(p => p.status === "UPLOADED").length;
          setCompletedCount(localCompleted);
          setTotalEarnings(localCompleted * fallbackRate);
        }

        const localActive = data.filter(p => !["UPLOADED", "CANCELLED", "ON_HOLD"].includes(p.status)).length;
        setActiveCount(localActive);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleStatusUpdate = async (projectId: string, newStatus: string) => {
    try {
      await api.patch(`/projects/${projectId}/status`, { status: newStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
      if (selectedProject?.id === projectId) setSelectedProject(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadUrl || !selectedProject) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/projects/${selectedProject.id}/status`, { status: "EDITING_REVIEW" });
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, status: "EDITING_REVIEW" } : p));
      setSelectedProject(prev => prev ? { ...prev, status: "EDITING_REVIEW" } : null);
      setUploadUrl("");
      alert("deliverable submitted");
    } catch (err) {
      console.error("Submit failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });
      const response = await api.get(`/invoices/editor/pdf?month=${encodeURIComponent(month)}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `editor_invoice_${month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice generation failed:", err);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-base">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            Editor dashboard
          </h1>
          <p className="text-[16px] text-slate-500 mt-2">
            Access assigned work, submit deliverables, and track your earnings.
          </p>
        </div>
        <button
          onClick={handleGenerateInvoice}
          className="flex items-center gap-2 bg-accent text-white px-5 py-3 rounded-lg text-[14px] font-bold hover:opacity-90 transition-opacity cursor-pointer self-start md:self-auto shadow-sm"
        >
          generate invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "rate per video", value: formatCurrency(ratePerVideo), icon: DollarSign, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800" },
          { label: "completed videos", value: `${completedCount} videos`, icon: CheckCircle, color: "text-status-green", bg: "bg-status-green/10" },
          { label: "total earnings", value: formatCurrency(totalEarnings), icon: DollarSign, color: "text-accent", bg: "bg-accent/10" },
          { label: "active tasks", value: `${activeCount}`, icon: Clock, color: "text-status-amber", bg: "bg-status-amber/10" },
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

      {/* Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Assigned Projects */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Briefcase className="h-5 w-5 text-slate-450" />
            Assigned projects
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-20 flat-card bg-card border border-border">
              <Loader2 className="h-6 w-6 animate-spin text-slate-350" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 flat-card bg-card border border-border text-slate-400">
              <Briefcase className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              <p className="font-bold text-[15px]">No projects assigned yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`flat-card bg-card p-5 border transition-all cursor-pointer ${
                    selectedProject?.id === project.id
                      ? "border-slate-800 dark:border-slate-200 ring-1 ring-slate-800 dark:ring-slate-200"
                      : "border-border hover:border-slate-450"
                  }`}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="flex justify-between items-start gap-3">
                    <span className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[getStatusLabel(project.status)] || STATUS_COLORS.new_video}`}>
                      {getStatusLabel(project.status)}
                    </span>
                    {project.dueDate && (
                      <div className="flex items-center gap-1.5 text-[10px] text-status-red font-bold bg-status-red/5 px-2.5 py-1 border border-status-red/10 rounded shrink-0">
                        <Clock className="h-3 w-3" />
                        {new Date(project.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    )}
                  </div>
                  <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white mt-4 line-clamp-2 leading-snug">{project.title}</h3>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workstation */}
        <div className="space-y-4">
          <h2 className="text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <CheckSquare className="h-5 w-5 text-slate-450" />
            Task workstation
          </h2>

          {selectedProject ? (
            <div className="flat-card bg-card p-6 border border-border space-y-6">
              <div>
                <h3 className="text-[18px] font-bold text-slate-900 dark:text-white leading-tight">{selectedProject.title}</h3>
                <span className={`mt-3 inline-block px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[getStatusLabel(selectedProject.status)] || STATUS_COLORS.new_video}`}>
                  {getStatusLabel(selectedProject.status)}
                </span>
              </div>

              {/* Source Materials */}
              <div className="space-y-3">
                <span className="text-[12px] font-bold text-slate-455 uppercase tracking-wider block">source materials</span>
                <div className="grid grid-cols-2 gap-3">
                  {selectedProject.driveFolder && (
                    <a href={selectedProject.driveFolder} target="_blank" rel="noreferrer"
                      className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-slate-50 dark:hover:bg-slate-900/30 text-center gap-2">
                      <Briefcase className="h-5 w-5 text-slate-450" />
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">drive folder</span>
                    </a>
                  )}
                  {selectedProject.formLink && (
                    <a href={selectedProject.formLink} target="_blank" rel="noreferrer"
                      className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-slate-50 dark:hover:bg-slate-900/30 text-center gap-2">
                      <FileText className="h-5 w-5 text-slate-450" />
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">script</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Submit Deliverable */}
              <div className="space-y-4 border-t border-border pt-6">
                <span className="text-[12px] font-bold text-slate-455 uppercase tracking-wider block">submit deliverable</span>
                <form onSubmit={handleSubmitDeliverable} className="space-y-4">
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/.../export"
                    value={uploadUrl}
                    onChange={(e) => setUploadUrl(e.target.value)}
                    className="flat-control w-full"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 bg-accent text-white font-bold py-3 rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <Upload className="h-4 w-4" />
                    {isSubmitting ? "submitting..." : "submit for review"}
                  </button>
                </form>
              </div>

              {/* Quick Status */}
              <div className="space-y-3 border-t border-border pt-6">
                <span className="text-[12px] font-bold text-slate-455 uppercase tracking-wider block">quick status update</span>
                <div className="flex flex-wrap gap-2">
                  {["EDITING", "REVISION_1", "REVISION_2"].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusUpdate(selectedProject.id, s)}
                      className="text-[11px] font-bold border border-border hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      {getStatusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flat-card bg-card p-10 border border-border text-center flex flex-col items-center justify-center min-h-[220px]">
              <Briefcase className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-405">Select a project</p>
              <p className="text-xs text-slate-450 mt-1 max-w-[170px]">Click any project card to view materials and submit work.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
