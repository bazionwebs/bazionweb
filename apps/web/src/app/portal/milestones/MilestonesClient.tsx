'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Layers,
  Loader2,
  KeyRound,
  MessageSquarePlus,
} from 'lucide-react';
import { useClientProjects, useSignOffProjectTask } from '@/hooks/usePortalData';
import type { ApiProject, ApiProjectTask } from '@/hooks/usePortalData';
import { EmptyState, QueryError, SectionLoading } from '@/components/ui/QueryState';
import { formatDate } from '@/lib/format';
import { cn, toSafeExternalUrl } from '@/lib/utils';

const PROJECT_STATUS: Record<string, { label: string; className: string }> = {
  PLANNING: { label: 'Planning', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-100 text-blue-800 border border-blue-200' },
  REVIEW: { label: 'Awaiting Client Sign-Off', className: 'bg-amber-100 text-amber-800 border border-amber-200' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  ON_HOLD: { label: 'On Hold', className: 'bg-rose-100 text-rose-800 border border-rose-200' },
};

function projectStatusMeta(status: string) {
  return (
    PROJECT_STATUS[status] ?? {
      label: titleCaseSafe(status),
      className: 'bg-slate-100 text-slate-700 border border-slate-200',
    }
  );
}

function titleCaseSafe(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function TaskRow({
  task,
  index,
  canSignOff,
  onSignOff,
  signingOff,
}: {
  task: ApiProjectTask;
  index: number;
  canSignOff: boolean;
  onSignOff: () => void;
  signingOff: boolean;
}) {
  const meta =
    task.status === 'DONE'
      ? { Icon: CheckCircle2, className: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Completed' }
      : task.status === 'IN_PROGRESS'
        ? { Icon: Clock, className: 'text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Active Sprint' }
        : task.status === 'BLOCKED'
          ? { Icon: AlertTriangle, className: 'text-rose-600', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Blocked' }
          : { Icon: Circle, className: 'text-slate-300', badge: 'bg-white text-slate-500 border-slate-200', label: 'Queued' };

  return (
    <li
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border text-xs transition-colors',
        task.status === 'IN_PROGRESS'
          ? 'bg-blue-50/40 border-blue-200/80'
          : task.status === 'DONE'
            ? 'bg-emerald-50/20 border-emerald-100'
            : 'bg-slate-50/70 border-slate-100',
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <meta.Icon className={cn('w-4 h-4 shrink-0 mt-0.5', meta.className)} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-slate-400">M{index + 1}</span>
            <span className="font-bold text-[#0F172A]">{task.title}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', meta.badge)}>
              {meta.label}
            </span>
          </div>
          {task.description && (
            <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{task.description}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 pl-7 sm:pl-0">
        {task.status === 'DONE' && task.completedAt ? (
          <span className="text-[11px] font-medium text-emerald-700">
            Done {formatDate(task.completedAt)}
          </span>
        ) : task.dueDate ? (
          <span className="text-[11px] text-slate-400">Target {formatDate(task.dueDate)}</span>
        ) : null}

        {canSignOff && task.status !== 'DONE' && (
          <button
            type="button"
            onClick={onSignOff}
            disabled={signingOff}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold transition-colors"
          >
            {signingOff ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Approve &amp; Sign Off
          </button>
        )}
      </div>
    </li>
  );
}

function ProjectCard({ project }: { project: ApiProject }) {
  const signOffTask = useSignOffProjectTask();
  const [signOffError, setSignOffError] = useState<string | null>(null);
  const status = projectStatusMeta(project.status);
  const completion = Math.max(0, Math.min(100, project.completionPct ?? 0));
  const tasks = project.tasks ?? [];
  const doneCount = tasks.filter(t => t.status === 'DONE').length;
  const blockedCount = tasks.filter(t => t.status === 'BLOCKED').length;
  const inReview = project.status === 'REVIEW';

  const handleSignOff = (taskId: string) => {
    setSignOffError(null);
    signOffTask.mutate(
      { projectId: project.id, taskId },
      {
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setSignOffError(msg || 'Could not record milestone sign-off. Please try again.');
        },
      },
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-6 sm:p-7 border-b border-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-[#0F172A]">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
          <span
            className={cn(
              'inline-flex px-3 py-1 rounded-full text-[11px] font-bold shrink-0',
              status.className,
            )}
          >
            {status.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2563EB] to-[#14B8A6] rounded-full transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="text-xs font-extrabold text-[#2563EB] shrink-0">{completion}%</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          {project.startDate && <span>Kickoff: <strong className="text-slate-700">{formatDate(project.startDate)}</strong></span>}
          {project.dueDate && <span>Target Launch: <strong className="text-slate-700">{formatDate(project.dueDate)}</strong></span>}
          {tasks.length > 0 && (
            <span>
              Milestones: <strong className="text-slate-700">{doneCount} of {tasks.length} complete</strong>
            </span>
          )}
          {blockedCount > 0 && <span className="text-rose-600 font-semibold">{blockedCount} blocked</span>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {toSafeExternalUrl(project.stagingUrl) && (
            <a
              href={toSafeExternalUrl(project.stagingUrl) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-bold text-blue-800 hover:bg-blue-100 transition-colors"
            >
              Open Staging Preview <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {toSafeExternalUrl(project.productionUrl) && (
            <a
              href={toSafeExternalUrl(project.productionUrl) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              Visit Live Domain <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <Link
            href="/portal/vault"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
            Share Build Credentials
          </Link>
          <Link
            href="/portal/support?category=DEVELOPMENT"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-slate-400" />
            Send Sprint Feedback
          </Link>
        </div>

        {signOffError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
            {signOffError}
          </div>
        )}
      </div>

      {tasks.length > 0 ? (
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Engineering Milestones &amp; Deliverables
            </h4>
            {inReview && (
              <span className="text-[11px] font-semibold text-amber-700">
                Review active — approve deliverables below when ready
              </span>
            )}
          </div>
          <ul className="space-y-2.5">
            {tasks.map((task, idx) => (
              <TaskRow
                key={task.id}
                task={task}
                index={idx}
                canSignOff={inReview && task.status === 'IN_PROGRESS'}
                onSignOff={() => handleSignOff(task.id)}
                signingOff={signOffTask.isPending}
              />
            ))}
          </ul>
        </div>
      ) : (
        <div className="p-6">
          <p className="text-xs text-slate-400">
            Sprint milestones are being sequenced by your lead systems architect.
          </p>
        </div>
      )}
    </div>
  );
}

export default function MilestonesClient() {
  const { data: projects = [], isLoading, isError, error, refetch } = useClientProjects();

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div>
        <h2 className="text-xl font-extrabold text-[#0F172A]">Delivery Roadmap</h2>
        <p className="text-xs text-slate-400 mt-1">
          Live milestone tracking, staging links, and deliverable approvals for your scoped builds.
        </p>
      </div>

      {isLoading && <SectionLoading label="Loading your delivery roadmap…" />}

      {isError && !isLoading && (
        <QueryError message={error?.message} onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState
          title="No active projects yet"
          hint="Your delivery roadmap provisions automatically once your proposal kickoff deposit settles, or when our engineering team opens a migration sprint."
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
            When your engineer marks a stage ready for review, an <strong>Approve &amp; Sign Off</strong> button
            unlocks directly on that milestone. Need a scope addition or content update?{' '}
            <Link href="/portal/support?category=DEVELOPMENT" className="font-bold text-[#2563EB] hover:underline">
              Open a sprint request
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
