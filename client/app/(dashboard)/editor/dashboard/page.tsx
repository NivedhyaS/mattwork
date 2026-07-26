'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FolderKanban, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { formatEditorCurrency } from '@/lib/utils';
import { COMPLETED_STATUSES } from '@/lib/projectMetrics';
import Link from 'next/link';

export default function EditorDashboardPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const res = await api.get('/projects?limit=100');
        setProjects(res.data.data);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const threshold = Number(process.env.NEXT_PUBLIC_DEADLINE_THRESHOLD_DAYS || '3');

  // Pending Works: Assigned projects not completed
  const pendingProjects = projects.filter((p) => !COMPLETED_STATUSES.includes(p.status));
  const pendingWorksCount = pendingProjects.length;

  // Deadline Close Works: Due within threshold days
  const now = new Date().getTime();
  const deadlineCloseProjects = pendingProjects.filter((p) => {
    if (!p.dueDate) return false;
    const diffDays = Math.ceil((new Date(p.dueDate).getTime() - now) / 86_400_000);
    return diffDays >= 0 && diffDays <= threshold;
  });
  const deadlineCloseCount = deadlineCloseProjects.length;

  // Total Works Done: Completed projects
  const completedProjects = projects.filter((p) => COMPLETED_STATUSES.includes(p.status));
  const totalWorksDone = completedProjects.length;

  // Total Money Earned: Sum of Editor Price for completed projects
  const totalMoneyEarned = completedProjects.reduce((sum, p) => sum + Number(p.editorPrice || 0), 0);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-1 max-w-7xl mx-auto w-full bg-[#F6EFE9] text-[#3D2E24]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-tight text-[#3D2E24]">Editor Dashboard</h1>
          <p className="text-[16px] text-[#7C6A5A] mt-1">Overview of your workload and earnings.</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending Works */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div>
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Pending Works</span>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#3D2E24]">{pendingWorksCount}</div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">Active assigned projects</p>
          </div>
        </div>

        {/* Deadline Close */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div>
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Deadline Close</span>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#EA580C]">{deadlineCloseCount}</div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">Due in {threshold} days or less</p>
          </div>
        </div>

        {/* Works Done */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div>
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Works Done</span>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#3D2E24]">{totalWorksDone}</div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">Completed projects</p>
          </div>
        </div>

        {/* Money Earned */}
        <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all space-y-4">
          <div>
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">Money Earned</span>
          </div>
          <div>
            <div className="kpi-figure text-[38px] font-extrabold text-[#EA580C]">{formatEditorCurrency(totalMoneyEarned)}</div>
            <p className="text-[12px] text-[#7C6A5A] mt-1">From completed works</p>
          </div>
        </div>
      </div>

      {/* Upcoming Deadlines Section */}
      <div className="space-y-4">
        <h2 className="text-[20px] font-extrabold text-[#3D2E24]">Upcoming Deadlines</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {deadlineCloseProjects.length > 0 ? (
            deadlineCloseProjects.map((p) => (
              <Link key={p.id} href={`/editor/projects?open=${p.id}`}>
                <div className="p-6 bg-[#F6EFE9] rounded-3xl shadow-[-8px_-8px_16px_rgba(255,255,255,0.9),8px_8px_16px_rgba(206,187,172,0.65)] hover:shadow-[-10px_-10px_20px_rgba(255,255,255,0.95),10px_10px_20px_rgba(201,180,163,0.75)] transition-all cursor-pointer space-y-3">
                  <div>
                    <h3 className="font-extrabold text-[16px] text-[#3D2E24]">{p.title}</h3>
                    <p className="text-[13px] text-[#7C6A5A] line-clamp-1 mt-0.5">{p.client?.user?.name || p.client?.company || 'Client'}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-transparent">
                    <span className="text-[13px] font-extrabold text-[#EA580C]">
                      Due: {new Date(p.dueDate).toLocaleDateString()}
                    </span>
                    <span className="px-3 py-1 bg-[#F6EFE9] text-[#3D2E24] text-[12px] font-extrabold rounded-xl shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                      {p.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full p-10 text-center bg-[#F6EFE9] rounded-3xl shadow-[inset_4px_4px_8px_rgba(206,187,172,0.5),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] space-y-2">
              <p className="font-extrabold text-[16px] text-[#3D2E24]">No upcoming deadlines</p>
              <p className="text-[13px] text-[#7C6A5A]">You have no active projects due in the next {threshold} days.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
