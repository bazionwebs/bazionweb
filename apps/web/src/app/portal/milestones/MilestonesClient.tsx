'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useClientProjects } from '@/hooks/usePortalData';
import type { ApiProject, ApiProjectTask } from '@/hooks/usePortalData';
import { EmptyState, QueryError, SectionLoading } from '@/components/ui/QueryState';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const PROJECT_STATUS: Record<string, { label: string; className: string }> = {
  PLANNING: { label: 'Planning', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-100 text-blue-800 border border-blue-200' },
  REVIEW: { label: 'In Review', className: 'bg-amber-100 text-amber-800 border border-amber-200' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  ON_HOLD: { label: 'On Hold', className: 'bg-rose-100 text-rose-800 border border-rose-200' },
};

function projectStatusMeta(status: string) {
  return PROJECT_STATUS[status] ?? { label: titleCaseSafe(status), className: 'bg-slate-100 text-slate-700 border border-slate-200' };
}

function titleCaseSafe(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function TaskRow({ task }: { task: ApiProjectTask }) {
  const meta =
    task.status === 'DONE'
      ? { Icon: CheckCircle2, className: 'text-emerald-600' }
      : task.status === 'IN_PROGRESS'
      ? { Icon: Clock, className: 'text-amber-600' }
      : task.status === 'BLOCKED'
      ? { Icon: AlertTriangle, className: 'text-rose-600' }
      : { Icon: Circle, className: 'text-slate-300' };

  return (
    <li className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 text-xs">
      <div className="flex items-start gap-2.5 min-w-0">
        <meta.Icon className={cn('w-4 h-4 shrink-0 mt-0.5', meta.className)} />
        <div className="min-w-0">
          <div className="font-medium text-slate-700">{task.title}</div>
          {task.description && (
            <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{task.description}</div>
          )}
        </div>
      </div>
      {task.dueDate && <span className="text-[10px] text-slate-400 shrink-0">{formatDate(task.dueDate)}</span>}
    </li>
  );
}

function ProjectCard({ project }: { project: ApiProject }) {
  const status = projectStatusMeta(project.status);
  const completion = Math.max(0, Math.min(100, project.completionPct ?? 0));
  const tasks = project.tasks ?? [];
  const doneCount = tasks.filter(t => t.status === 'DONE').length;
  const blockedCount = tasks.filter(t => t.status === 'BLOCKED').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-[#0F172A]">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">{project.description}</p>
            )}
          </div>
          <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0', status.className)}>
            {status.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6] rounded-full"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="text-xs font-extrabold text-[#2563EB] shrink-0">{completion}%</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
          {project.startDate && <span>Started {formatDate(project.startDate)}</span>}
          {project.dueDate && <span>Target {formatDate(project.dueDate)}</span>}
          {tasks.length > 0 && <span>{doneCount}/{tasks.length} tasks done</span>}
          {blockedCount > 0 && <span className="text-rose-600 font-semibold">{blockedCount} blocked</span>}
        </div>

        {(project.stagingUrl || project.productionUrl) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {project.stagingUrl && (
              <a
                href={project.stagingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                Open Staging <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {project.productionUrl && (
              <a
                href={project.productionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
              >
                Open Live Site <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {tasks.length > 0 ? (
        <div className="p-6">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Sprint Tasks</h4>
          <ul className="space-y-2">
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="p-6">
          <p className="text-xs text-slate-400">
            Tasks are not published for this project yet — your engineer shares the live plan during onboarding.
          </p>
        </div>
      )}
    </div>
  );
}

export default function MilestonesClient() {
  const { data: projects = [], isLoading, isError, error, refetch } = useClientProjects();

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-extrabold text-[#0F172A]">Delivery Roadmap</h2>
        <p className="text-xs text-slate-400 mt-1">
          Live progress for your active projects. Milestone sign-offs and delivery
          reviews are handled with your lead engineer.
        </p>
      </div>

      {isLoading && <SectionLoading label="Loading your roadmap…" />}

      {isError && !isLoading && (
        <QueryError message={error?.message} onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState
          title="No active projects yet"
          hint="Your delivery plan appears here once your first project is scoped. New to the workspace? Submit a request from the Support tab to get started."
        />
      )}

      {!isLoading && !isError && projects.length > 0 && (
        <div className="space-y-6">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {projects.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex items-start gap-3">
          <Layers className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Formal milestone sign-offs are recorded offline with your lead engineer and stored in the
            project contract. Want a change of scope?{' '}
            <Link href="/portal/support" className="font-bold text-[#2563EB] hover:underline">
              Submit a request
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
