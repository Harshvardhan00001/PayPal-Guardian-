'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Activity,
  Bot,
  ArrowRight,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { AgentSimulatorPanel } from '../components/AgentSimulatorPanel';
import { fetchFromApi } from '../lib/api';

export default function HomePage() {
  const [activePolicy, setActivePolicy] = useState<any | null>(null);
  const [stats, setStats] = useState({
    totalPolicies: 1,
    activePolicyId: 'pol_running_shoes_default'
  });

  useEffect(() => {
    async function loadPolicies() {
      try {
        const res = await fetchFromApi('/api/v1/policies');
        if (res.success && res.data && res.data.length > 0) {
          const first = res.data[0];
          setActivePolicy(first);
          setStats({
            totalPolicies: res.data.length,
            activePolicyId: first.id
          });
        }
      } catch (err) {
        // Fallback default
        setActivePolicy({
          id: 'pol_running_shoes_default',
          name: 'Running Shoes Protection Policy',
          description: 'Buy running shoes under ₹8,000. No subscriptions. Ask me before paying.',
          status: 'ACTIVE',
          rules: {
            max_amount: 8000,
            currency: 'INR',
            max_quantity: 1,
            allowed_categories: ['running_shoes'],
            recurring_allowed: false,
            approval_required: true
          }
        });
      }
    }
    loadPolicies();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-950/30 via-slate-900/60 to-slate-900/20 border border-indigo-500/20 rounded-3xl p-8 sm:p-12 shadow-2xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-400 font-semibold mb-6">
            <Lock className="w-3.5 h-3.5" />
            <span>AI Transaction Policy & Authorization Gateway</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            The firewall between <br />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200 bg-clip-text text-transparent">
              AI agents and your money.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed mt-5">
            AI shopping agents are gaining autonomous browsing and checkout capabilities. PayPal Guardian ensures users maintain absolute control: natural language policies convert into immutable mathematical boundaries, transactions are strictly verified, and payments execute through PayPal Sandbox only after explicit cryptographic authorization.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/policies/new"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Policy</span>
            </Link>

            <a
              href="#simulator"
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl transition border border-slate-700 flex items-center space-x-2"
            >
              <Bot className="w-4 h-4 text-indigo-400" />
              <span>Launch Simulator</span>
            </a>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 pt-8 border-t border-slate-800">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Zero-LLM Authority</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                LLMs parse natural language, but deterministic rules make 100% of payment decisions.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Tamper Guard Hashes</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                RFC 8785 canonical hashes bind approvals. Changing 1 cent instantly halts payment.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">PayPal Orders v2</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Server-side authorization, capture, and verified asynchronous webhooks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Active Guardian Policy Card */}
      {activePolicy && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-white">{activePolicy.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-400">ID: {activePolicy.id}</p>
              </div>
            </div>

            <Link
              href="/policies/new"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1"
            >
              <span>Switch / Create Policy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Max Budget</span>
              <div className="text-sm font-bold text-white mt-0.5">
                {activePolicy.rules?.currency || 'INR'} {activePolicy.rules?.max_amount?.toLocaleString() || '8,000'}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Max Quantity</span>
              <div className="text-sm font-bold text-white mt-0.5">
                {activePolicy.rules?.max_quantity || 1} unit
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Recurring Fees</span>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">
                {activePolicy.rules?.recurring_allowed ? 'Allowed' : 'Strictly Blocked'}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Approval Flow</span>
              <div className="text-sm font-bold text-indigo-400 mt-0.5">
                {activePolicy.rules?.approval_required ? 'Required' : 'Auto-Approve'}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Simulator Section */}
      <section id="simulator">
        <AgentSimulatorPanel activePolicyId={stats.activePolicyId} />
      </section>
    </div>
  );
}
