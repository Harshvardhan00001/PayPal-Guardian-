'use client';

import React, { useEffect, useState } from 'react';
import {
  Clock,
  ShieldCheck,
  Bot,
  User,
  CreditCard,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { fetchFromApi } from '../lib/api';

export interface AuditItem {
  id: string;
  timestamp: string;
  event_type: string;
  actor: 'USER' | 'AI_AGENT' | 'POLICY_ENGINE' | 'PAYPAL_SERVICE' | 'PAYPAL_WEBHOOK' | string;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
  verified?: boolean;
}

interface AuditTimelineVisualizerProps {
  transactionId?: string;
  initialItems?: AuditItem[];
  autoRefresh?: boolean;
}

export function AuditTimelineVisualizer({
  transactionId,
  initialItems,
  autoRefresh = false
}: AuditTimelineVisualizerProps) {
  const [items, setItems] = useState<AuditItem[]>(initialItems || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAuditTrail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (transactionId) {
        const res = await fetchFromApi(`/api/v1/transactions/${transactionId}/audit`);
        if (res.success && res.data?.timeline) {
          setItems(res.data.timeline);
        }
      } else {
        const res = await fetchFromApi('/api/v1/audit?limit=25');
        if (res.success && res.data) {
          setItems(res.data);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialItems || initialItems.length === 0) {
      loadAuditTrail();
    }
  }, [transactionId]);

  const getActorBadge = (actor: string) => {
    switch (actor) {
      case 'AI_AGENT':
        return {
          icon: Bot,
          label: 'AI Agent',
          className: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
        };
      case 'POLICY_ENGINE':
        return {
          icon: ShieldCheck,
          label: 'Policy Engine',
          className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
        };
      case 'USER':
        return {
          icon: User,
          label: 'Human User',
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        };
      case 'PAYPAL_SERVICE':
        return {
          icon: CreditCard,
          label: 'PayPal Sandbox',
          className: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        };
      case 'PAYPAL_WEBHOOK':
        return {
          icon: Radio,
          label: 'PayPal Webhook',
          className: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        };
      default:
        return {
          icon: ShieldCheck,
          label: actor,
          className: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
        };
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <Clock className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-base font-bold text-white">Forensic Audit Timeline</h3>
            <p className="text-xs text-slate-400">
              {transactionId
                ? `Cryptographic event trail for Tx: ${transactionId.substring(0, 8)}...`
                : 'Append-only chronological security log across all agents'}
            </p>
          </div>
        </div>

        <button
          onClick={loadAuditTrail}
          disabled={isLoading}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          title="Refresh Trail"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {items.length === 0 && !isLoading && (
        <div className="py-10 text-center text-xs text-slate-500">
          No audit records logged yet. Run a proposal or test simulation.
        </div>
      )}

      {/* Timeline items */}
      <div className="mt-6 relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {items.map((item, idx) => {
          const actorInfo = getActorBadge(item.actor);
          const ActorIcon = actorInfo.icon;
          const formattedDate = new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          return (
            <div key={item.id || idx} className="relative group">
              {/* Timeline dot */}
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-950 border-2 border-indigo-500 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
              </div>

              {/* Event card */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 transition hover:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${actorInfo.className}`}
                    >
                      <ActorIcon className="w-3 h-3" />
                      <span>{actorInfo.label}</span>
                    </span>

                    <span className="text-xs font-bold text-white">
                      {item.title || item.event_type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{formattedDate}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {item.description || JSON.stringify(item.metadata || {})}
                </p>

                {item.metadata && Object.keys(item.metadata).length > 0 && (
                  <details className="mt-2 text-[11px] text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-300 font-mono">
                      Event Metadata
                    </summary>
                    <pre className="mt-1 p-2 bg-slate-900/90 rounded border border-slate-800 text-[10px] font-mono text-indigo-300 overflow-x-auto">
                      {JSON.stringify(item.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
