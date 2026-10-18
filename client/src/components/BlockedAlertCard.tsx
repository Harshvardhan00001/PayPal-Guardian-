'use client';

import React from 'react';
import { ShieldAlert, AlertOctagon, XCircle, ArrowRight } from 'lucide-react';

export interface BlockedReason {
  code: string;
  message: string;
  metadata?: Record<string, any>;
}

interface BlockedAlertCardProps {
  transactionId: string;
  merchant: string;
  total: number;
  currency: string;
  reasons: BlockedReason[];
  snapshotHash?: string;
}

export function BlockedAlertCard({
  transactionId,
  merchant,
  total,
  currency,
  reasons,
  snapshotHash
}: BlockedAlertCardProps) {
  return (
    <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-6 shadow-xl shadow-rose-950/50">
      <div className="flex items-start justify-between pb-4 border-b border-rose-900/40">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white">Transaction Blocked by Guardian</h3>
              <span className="px-2 py-0.5 rounded text-xs font-black bg-rose-500 text-white tracking-wider">
                BLOCK
              </span>
            </div>
            <p className="text-xs text-rose-300 mt-0.5">
              Deterministic policy boundary violation prevented unauthorized checkout
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Proposed Total</div>
          <div className="text-lg font-extrabold text-white">
            {currency} {total?.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Rationale list */}
      <div className="mt-5 space-y-3">
        <span className="text-xs font-bold text-rose-300 uppercase tracking-wider block">
          Policy Violations Detected ({reasons.length}):
        </span>

        {reasons.map((r, idx) => (
          <div
            key={idx}
            className="p-3.5 bg-slate-950/80 rounded-xl border border-rose-500/20 flex items-start space-x-3"
          >
            <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-mono font-bold text-rose-400">{r.code}</div>
              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{r.message}</p>
              {r.metadata && Object.keys(r.metadata).length > 0 && (
                <div className="mt-2 text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800 font-mono">
                  {JSON.stringify(r.metadata)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Security Context */}
      <div className="mt-5 pt-4 border-t border-rose-900/30 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center space-x-2">
          <span>Snapshot Hash:</span>
          <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded text-[11px]">
            {snapshotHash ? `${snapshotHash.substring(0, 16)}...` : 'N/A'}
          </span>
        </div>
        <span className="text-emerald-400 font-medium">✓ Zero money deducted from PayPal</span>
      </div>
    </div>
  );
}
