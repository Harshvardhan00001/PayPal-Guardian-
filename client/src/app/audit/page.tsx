'use client';

import React from 'react';
import { History, ShieldCheck } from 'lucide-react';
import { AuditTimelineVisualizer } from '../../components/AuditTimelineVisualizer';

export default function AuditPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full">
      <div className="mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-3 border border-indigo-500/20">
          <History className="w-3.5 h-3.5" />
          <span>Immutable Ledger</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Forensic Audit Log
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Complete, tamper-evident record of all AI agent shopping proposals, deterministic policy evaluations, user approvals, and PayPal payment captures.
        </p>
      </div>

      <AuditTimelineVisualizer />
    </div>
  );
}
