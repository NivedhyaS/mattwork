'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FolderKanban, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { formatEditorCurrency } from '@/lib/utils';
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

  // Pending Works: Assigned projects not completed (UPLOADED)
  const pendingProjects = projects.filter((p) => p.status !== 'UPLOADED');
  const pendingWorksCount = pendingProjects.length;

  // Deadline Close Works: Due within threshold days
  const now = new Date().getTime();
  const deadlineCloseProjects = pendingProjects.filter((p) => {
    if (!p.dueDate) return false;
    const diffDays = Math.ceil((new Date(p.dueDate).getTime() - now) / 86_400_000);
    return diffDays >= 0 && diffDays <= threshold;
  });
  const deadlineCloseCount = deadlineCloseProjects.length;

  // Total Works Done: Completed projects (UPLOADED)
  const completedProjects = projects.filter((p) => p.status === 'UPLOADED');
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
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Editor Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Overview of your workload and earnings.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pending Works</CardTitle>
            <FolderKanban className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{pendingWorksCount}</div>
            <p className="text-xs text-slate-500 mt-1">Active assigned projects</p>
          </CardContent>
        </Card>

        <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-amber-500 uppercase tracking-wider">Deadline Close</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{deadlineCloseCount}</div>
            <p className="text-xs text-slate-500 mt-1">Due in {threshold} days or less</p>
          </CardContent>
        </Card>

        <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-emerald-500 uppercase tracking-wider">Works Done</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalWorksDone}</div>
            <p className="text-xs text-slate-500 mt-1">Completed projects</p>
          </CardContent>
        </Card>

        <Card className="shadow-none border border-slate-200 dark:border-slate-800 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-violet-500 uppercase tracking-wider">Money Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{formatEditorCurrency(totalMoneyEarned)}</div>
            <p className="text-xs text-slate-500 mt-1">From completed works</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Upcoming Deadlines</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deadlineCloseProjects.length > 0 ? (
            deadlineCloseProjects.map((p) => (
              <Link key={p.id} href={`/editor/projects?open=${p.id}`}>
                <Card className="shadow-none border border-slate-200 dark:border-slate-800 hover:border-violet-500/50 transition-colors cursor-pointer bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <CardDescription className="line-clamp-1">{p.client?.user?.name || p.client?.company || 'Client'}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-500">
                      Due: {new Date(p.dueDate).toLocaleDateString()}
                    </span>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-md">
                      {p.status.replace(/_/g, ' ')}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              No projects with upcoming deadlines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
