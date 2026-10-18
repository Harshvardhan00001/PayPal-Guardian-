'use client';

import React from 'react';
import { ShieldCheck, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export interface PolicyParsedData {
  rules: {
    max_amount: number;
    currency: string;
    max_quantity: number;
    allowed_categories: string[];
    blocked_categories: string[];
    allowed_merchants: string[];
    blocked_merchants: string[];
    recurring_allowed: boolean;
    approval_required: boolean;
    recheck_on_change: boolean;
  };
  explanation?: string;
  confidence?: number;
}

interface PolicyConfirmationCardProps {
  parsedData: PolicyParsedData;
  onActivate: () => void;
  onEdit: () => void;
  isActivating: boolean;
}

export function PolicyConfirmationCard({
  parsedData,
  onActivate,
  onEdit,
  isActivating
}: PolicyConfirmationCardProps) {
  const { rules, explanation } = parsedData;

  return (
    <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl shadow-indigo-500/5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Guardian Understood</h3>
            <p className="text-xs text-slate-400">Review structured rules before activating policy</p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Ready for Activation
        </span>
      </div>

      {explanation && (
        <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300">
          <span className="font-semibold text-indigo-400">Interpretation: </span>
          {explanation}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Maximum Amount */}
        <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium">Maximum Spending Limit</span>
          <div className="text-lg font-bold text-white mt-0.5">
            {rules.currency} {rules.max_amount?.toLocaleString() || 'Unlimited'}
          </div>
        </div>

        {/* Quantity */}
        <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium">Maximum Quantity</span>
          <div className="text-lg font-bold text-white mt-0.5">
            {rules.max_quantity || 1} item{rules.max_quantity > 1 ? 's' : ''}
          </div>
        </div>

        {/* Subscriptions */}
        <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Recurring Subscriptions</span>
            <div className="text-sm font-semibold mt-0.5">
              {rules.recurring_allowed ? (
                <span className="text-amber-400 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1 inline" /> Allowed
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center">
                  <XCircle className="w-4 h-4 mr-1 inline" /> Strictly Blocked
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Human Approval */}
        <div className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Human Authorization</span>
            <div className="text-sm font-semibold mt-0.5">
              {rules.approval_required ? (
                <span className="text-indigo-400 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1 inline" /> Always Required
                </span>
              ) : (
                <span className="text-slate-300">Auto-approve within bounds</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Categories & Merchants */}
      <div className="mt-3 space-y-2">
        <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Allowed Categories: </span>
          <span className="text-slate-200 font-medium">
            {rules.allowed_categories && rules.allowed_categories.length > 0
              ? rules.allowed_categories.join(', ')
              : 'Any category'}
          </span>
        </div>

        {rules.blocked_categories && rules.blocked_categories.length > 0 && (
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs">
            <span className="text-slate-400 font-medium">Blocked Categories: </span>
            <span className="text-rose-300 font-medium">{rules.blocked_categories.join(', ')}</span>
          </div>
        )}

        <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Tamper Guard (Recheck on Change): </span>
          <span className="text-emerald-400 font-medium">
            {rules.recheck_on_change ? 'Active (Invalidates payment on cart shift)' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Raw JSON Toggle / View */}
      <details className="mt-4 text-xs text-slate-400">
        <summary className="cursor-pointer hover:text-slate-200 font-mono">View Structured JSON Rules</summary>
        <pre className="mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-indigo-300 overflow-x-auto">
          {JSON.stringify(rules, null, 2)}
        </pre>
      </details>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={onActivate}
          disabled={isActivating}
          className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30"
        >
          {isActivating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              <span>Activating Policy...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              <span>Activate Policy</span>
            </>
          )}
        </button>

        <button
          onClick={onEdit}
          disabled={isActivating}
          className="w-full sm:w-auto py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition"
        >
          Edit Instruction
        </button>
      </div>
    </div>
  );
}
