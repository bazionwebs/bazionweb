'use client';

import React from 'react';
import { Play, Pause, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import type { UseAdminPollingReturn } from '@/hooks/useAdminPolling';

export interface AdminPollingControlBarProps {
  controller: UseAdminPollingReturn;
  className?: string;
  onRefresh?: () => Promise<void> | void;
}

export function AdminPollingControlBar({ controller, className = '', onRefresh }: AdminPollingControlBarProps) {
  const {
    isPollingEnabled,
    togglePolling,
    pollingInterval,
    setPollingInterval,
    lastRefreshed,
    manualRefresh,
    isRefreshing,
    isVisible,
  } = controller;

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    if (val === 0) {
      if (isPollingEnabled) togglePolling();
    } else {
      setPollingInterval(val);
      if (!isPollingEnabled) togglePolling();
    }
  };

  const handleRefreshClick = () => {
    manualRefresh(onRefresh);
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm ${className}`}
      role="toolbar"
      aria-label="Admin Polling and Refresh Controls"
    >
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              !isVisible
                ? 'bg-amber-400'
                : isPollingEnabled
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-slate-400'
            }`}
            title={
              !isVisible
                ? 'Tab hidden — polling suspended'
                : isPollingEnabled
                ? 'Live auto-refresh active'
                : 'Auto-refresh paused'
            }
          />
          <span className="font-medium text-slate-700 text-xs hidden sm:inline">
            {!isVisible
              ? 'Tab Inactive (Paused)'
              : isPollingEnabled
              ? 'Live Polling'
              : 'Polling Paused'}
          </span>
        </div>

        {/* Pause/Resume Toggle Button */}
        <button
          type="button"
          onClick={togglePolling}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
            isPollingEnabled
              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          }`}
          aria-label={isPollingEnabled ? 'Pause auto-refresh' : 'Resume auto-refresh'}
        >
          {isPollingEnabled ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </>
          )}
        </button>

        {/* Interval Dropdown */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={isPollingEnabled ? pollingInterval : 0}
            onChange={handleIntervalChange}
            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Polling interval selector"
          >
            <option value={15000}>15s (Real-time)</option>
            <option value={30000}>30s (Standard)</option>
            <option value={60000}>60s (Relaxed)</option>
            <option value={0}>Manual (Paused)</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Last Refreshed Stamp */}
        <span className="text-xs text-slate-500 hidden md:inline">
          Updated: {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'Never'}
        </span>

        {/* Refresh Now Trigger */}
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md font-medium text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          aria-label="Refresh data now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing…' : 'Refresh Now'}</span>
        </button>
      </div>
    </div>
  );
}

export default AdminPollingControlBar;
