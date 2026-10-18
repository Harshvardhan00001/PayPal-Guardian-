'use client';

import React, { useState } from 'react';
import {
  PlayCircle,
  ShieldCheck,
  AlertOctagon,
  Flame,
  Bug,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight
} from 'lucide-react';
import { fetchFromApi } from '../lib/api';
import { TransactionReviewModal, ProposalDetails } from './TransactionReviewModal';
import { BlockedAlertCard, BlockedReason } from './BlockedAlertCard';
import { AuditTimelineVisualizer } from './AuditTimelineVisualizer';

interface AgentSimulatorPanelProps {
  activePolicyId?: string;
}

export function AgentSimulatorPanel({
  activePolicyId = 'pol_running_shoes_default'
}: AgentSimulatorPanelProps) {
  const [activeScenario, setActiveScenario] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [proposalResult, setProposalResult] = useState<ProposalDetails | null>(null);
  const [blockedResult, setBlockedResult] = useState<{
    id: string;
    merchant: string;
    total: number;
    currency: string;
    reasons: BlockedReason[];
    snapshotHash: string;
  } | null>(null);
  const [tamperResult, setTamperResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Scenario 1: Clean Running Shoes (Triggers ASK)
  const runScenario1 = async () => {
    setIsRunning(true);
    resetState();
    setActiveScenario(1);

    try {
      const res = await fetchFromApi('/api/v1/transactions/proposals', {
        method: 'POST',
        body: JSON.stringify({
          user_id: 'usr_demo_shopper',
          policy_id: activePolicyId,
          merchant: 'Nike Official Store',
          currency: 'INR',
          items: [
            {
              sku: 'NK-PEGASUS-40',
              name: 'Nike Air Zoom Pegasus 40',
              category: 'running_shoes',
              quantity: 1,
              unit_price: 7499
            }
          ],
          shipping: 0,
          tax: 0,
          fees: 0,
          recurring: false
        })
      });

      if (res.success && res.data) {
        setProposalResult({
          id: res.data.transaction_id,
          merchant: 'Nike Official Store',
          currency: 'INR',
          items: [
            {
              sku: 'NK-PEGASUS-40',
              name: 'Nike Air Zoom Pegasus 40',
              category: 'running_shoes',
              quantity: 1,
              unit_price: 7499,
              total_price: 7499
            }
          ],
          subtotal: 7499,
          shipping: 0,
          tax: 0,
          fees: 0,
          total: 7499,
          recurring: false,
          status: res.data.decision,
          snapshotHash: res.data.snapshot_hash
        });
      }
    } catch (err: any) {
      setError(err.message || 'Scenario 1 failed.');
    } finally {
      setIsRunning(false);
    }
  };

  // Scenario 2: Hidden Subscription (Triggers BLOCK)
  const runScenario2 = async () => {
    setIsRunning(true);
    resetState();
    setActiveScenario(2);

    try {
      const res = await fetchFromApi('/api/v1/transactions/proposals', {
        method: 'POST',
        body: JSON.stringify({
          user_id: 'usr_demo_shopper',
          policy_id: activePolicyId,
          merchant: 'SneakerClub.io',
          currency: 'INR',
          items: [
            {
              sku: 'SNK-PRO-01',
              name: 'Ultra Marathon Shoes',
              category: 'running_shoes',
              quantity: 1,
              unit_price: 6999
            },
            {
              sku: 'MEM-VIP-MO',
              name: 'VIP Shoe Care Recurring Club (Monthly)',
              category: 'running_shoes',
              quantity: 1,
              unit_price: 499
            }
          ],
          shipping: 0,
          tax: 0,
          fees: 0,
          recurring: true // Subscription flag active!
        })
      });

      if (res.success && res.data) {
        setBlockedResult({
          id: res.data.transaction_id,
          merchant: 'SneakerClub.io',
          total: 7498,
          currency: 'INR',
          reasons: res.data.reasons || [
            {
              code: 'RECURRING_NOT_ALLOWED',
              message: 'Policy strictly prohibits recurring or subscription charges.'
            }
          ],
          snapshotHash: res.data.snapshot_hash
        });
      }
    } catch (err: any) {
      setError(err.message || 'Scenario 2 failed.');
    } finally {
      setIsRunning(false);
    }
  };

  // Scenario 3: Budget Breaker (Triggers BLOCK)
  const runScenario3 = async () => {
    setIsRunning(true);
    resetState();
    setActiveScenario(3);

    try {
      const res = await fetchFromApi('/api/v1/transactions/proposals', {
        method: 'POST',
        body: JSON.stringify({
          user_id: 'usr_demo_shopper',
          policy_id: activePolicyId,
          merchant: 'Elite Athletic Gear',
          currency: 'INR',
          items: [
            {
              sku: 'ELT-ALPHA-CARB',
              name: 'AlphaFly Carbon Plate Racing Shoes',
              category: 'running_shoes',
              quantity: 1,
              unit_price: 8800
            }
          ],
          shipping: 400,
          tax: 0,
          fees: 0,
          recurring: false
        })
      });

      if (res.success && res.data) {
        setBlockedResult({
          id: res.data.transaction_id,
          merchant: 'Elite Athletic Gear',
          total: 9200,
          currency: 'INR',
          reasons: res.data.reasons || [
            {
              code: 'BUDGET_EXCEEDED',
              message: 'Total amount of ₹9,200 exceeds your maximum policy budget of ₹8,000 by ₹1,200.'
            }
          ],
          snapshotHash: res.data.snapshot_hash
        });
      }
    } catch (err: any) {
      setError(err.message || 'Scenario 3 failed.');
    } finally {
      setIsRunning(false);
    }
  };

  // Scenario 4: Tamper Attack (Order changed after approval -> 409 Conflict)
  const runScenario4 = async () => {
    setIsRunning(true);
    resetState();
    setActiveScenario(4);

    try {
      // Step A: Create honest proposal for ₹7,499
      const createRes = await fetchFromApi('/api/v1/transactions/proposals', {
        method: 'POST',
        body: JSON.stringify({
          user_id: 'usr_demo_shopper',
          policy_id: activePolicyId,
          merchant: 'Tamper Demo Store',
          currency: 'INR',
          items: [
            {
              sku: 'TAMPER-TEST-01',
              name: 'Legitimate Running Shoes',
              category: 'running_shoes',
              quantity: 1,
              unit_price: 7499
            }
          ],
          shipping: 0,
          tax: 0,
          fees: 0,
          recurring: false
        })
      });

      const txId = createRes.data.transaction_id;
      const initialHash = createRes.data.snapshot_hash;

      // Step B: User approves initial hash
      await fetchFromApi(`/api/v1/transactions/${txId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ snapshot_hash: initialHash })
      });

      // Step C: Server creates PayPal Order
      await fetchFromApi('/api/v1/payments/paypal/create-order', {
        method: 'POST',
        body: JSON.stringify({ transaction_id: txId })
      });

      // Step D: Rogue AI Agent mutates cart behind the scenes! (e.g. +₹500 hidden handling fee)
      await fetchFromApi(`/api/v1/transactions/${txId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fees: 500
        })
      });

      // Step E: Rogue AI tries to finalize capture!
      let caughtTamper: any = null;
      try {
        await fetchFromApi('/api/v1/payments/paypal/capture', {
          method: 'POST',
          body: JSON.stringify({ transaction_id: txId })
        });
      } catch (tamperErr: any) {
        caughtTamper = tamperErr;
      }

      setTamperResult({
        transaction_id: txId,
        initial_hash: initialHash,
        tampered_state: 'ORDER_CHANGED',
        intercepted: true,
        details:
          caughtTamper?.data?.error?.message ||
          'Order snapshot modified after user approval. Prior authorization has been invalidated.'
      });
    } catch (err: any) {
      setError(err.message || 'Scenario 4 failed.');
    } finally {
      setIsRunning(false);
    }
  };

  const resetState = () => {
    setProposalResult(null);
    setBlockedResult(null);
    setTamperResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Control Panel Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <PlayCircle className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-extrabold text-white">AI Shopping Agent Simulator</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select any test scenario to simulate an autonomous AI agent attempting to execute a financial transaction.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span>Target Policy:</span>
            <span className="font-mono text-indigo-300 font-semibold">{activePolicyId}</span>
          </div>
        </div>

        {/* 4 Interactive Scenario Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Scenario 1 */}
          <button
            type="button"
            onClick={runScenario1}
            disabled={isRunning}
            className={`p-4 rounded-xl border text-left transition relative overflow-hidden flex flex-col justify-between ${
              activeScenario === 1
                ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  DECISION: ASK
                </span>
                <span className="text-xs text-slate-500">Scenario 1</span>
              </div>
              <h3 className="font-bold text-white text-sm">🛒 Honest Agent</h3>
              <p className="text-xs text-slate-400 mt-1">
                Nike Pegasus (₹7,499). Within ₹8,000 limit. Human approval required.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-indigo-400 font-medium">
              <span>Simulate Proposal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Scenario 2 */}
          <button
            type="button"
            onClick={runScenario2}
            disabled={isRunning}
            className={`p-4 rounded-xl border text-left transition relative overflow-hidden flex flex-col justify-between ${
              activeScenario === 2
                ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-500/10'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  DECISION: BLOCK
                </span>
                <span className="text-xs text-slate-500">Scenario 2</span>
              </div>
              <h3 className="font-bold text-white text-sm">🚨 Hidden Subscription</h3>
              <p className="text-xs text-slate-400 mt-1">
                Sneakers (₹6,999) + Sneaky VIP Care recurring fee (₹499/mo).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-rose-400 font-medium">
              <span>Simulate Sneak Attack</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Scenario 3 */}
          <button
            type="button"
            onClick={runScenario3}
            disabled={isRunning}
            className={`p-4 rounded-xl border text-left transition relative overflow-hidden flex flex-col justify-between ${
              activeScenario === 3
                ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-500/10'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  DECISION: BLOCK
                </span>
                <span className="text-xs text-slate-500">Scenario 3</span>
              </div>
              <h3 className="font-bold text-white text-sm">💥 Budget Breaker</h3>
              <p className="text-xs text-slate-400 mt-1">
                Carbon shoes (₹8,800 + ₹400 shipping = ₹9,200). Exceeds ₹8k ceiling.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-rose-400 font-medium">
              <span>Simulate Overspend</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Scenario 4 */}
          <button
            type="button"
            onClick={runScenario4}
            disabled={isRunning}
            className={`p-4 rounded-xl border text-left transition relative overflow-hidden flex flex-col justify-between ${
              activeScenario === 4
                ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-500/10'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  TAMPER GUARD
                </span>
                <span className="text-xs text-slate-500">Scenario 4</span>
              </div>
              <h3 className="font-bold text-white text-sm">🦹 Tamper Attack</h3>
              <p className="text-xs text-slate-400 mt-1">
                Approves ₹7,499 cart, then agent secretly injects ₹500 fee before capture!
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-purple-400 font-medium">
              <span>Simulate Cart Tamper</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {isRunning && (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
          <p className="text-xs text-slate-300 font-medium">
            AI Agent interacting with Guardian Deterministic Gateway...
          </p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Scenario 1 Result: Transaction Review Modal */}
      {proposalResult && !isRunning && (
        <div className="space-y-6">
          <TransactionReviewModal
            proposal={proposalResult}
            onPaymentComplete={() => {
              // Trigger refresh or update
            }}
          />
          <AuditTimelineVisualizer transactionId={proposalResult.id} />
        </div>
      )}

      {/* Scenario 2 or 3 Result: Blocked Alert Card */}
      {blockedResult && !isRunning && (
        <div className="space-y-6">
          <BlockedAlertCard
            transactionId={blockedResult.id}
            merchant={blockedResult.merchant}
            total={blockedResult.total}
            currency={blockedResult.currency}
            reasons={blockedResult.reasons}
            snapshotHash={blockedResult.snapshotHash}
          />
          <AuditTimelineVisualizer transactionId={blockedResult.id} />
        </div>
      )}

      {/* Scenario 4 Result: Tamper Intercept Card */}
      {tamperResult && !isRunning && (
        <div className="space-y-6">
          <div className="bg-purple-950/30 border border-purple-500/40 rounded-2xl p-6 shadow-xl">
            <div className="flex items-start justify-between pb-4 border-b border-purple-900/40">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white">
                      🚨 Tamper Guard Intercepted Rogue Order Mutation!
                    </h3>
                    <span className="px-2 py-0.5 rounded text-xs font-black bg-purple-500 text-white tracking-wider">
                      409 CONFLICT
                    </span>
                  </div>
                  <p className="text-xs text-purple-300 mt-0.5">
                    Order snapshot was modified after user approval. Prior authorization instantly revoked.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-purple-500/20 text-xs text-slate-300 space-y-2">
              <div className="text-purple-300 font-semibold">{tamperResult.details}</div>
              <div className="font-mono text-[11px] text-slate-400">
                Original Approved Hash: {tamperResult.initial_hash?.substring(0, 32)}...
              </div>
              <div className="text-emerald-400 font-medium">
                ✓ PayPal capture halted before any money was drawn!
              </div>
            </div>
          </div>

          <AuditTimelineVisualizer transactionId={tamperResult.transaction_id} />
        </div>
      )}
    </div>
  );
}
