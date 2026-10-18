'use client';

import React, { useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, Terminal } from 'lucide-react';
import { fetchFromApi } from '../../../lib/api';
import { PolicyConfirmationCard, PolicyParsedData } from '../../../components/PolicyConfirmationCard';

const SAMPLE_PROMPTS = [
  'Buy me running shoes under ₹8,000. Only one pair. No subscriptions. Ask me before making payment.',
  'Never spend more than ₹5,000 without asking me. Block any recurring charges.',
  'Order office supplies under ₹3,000 from Amazon. Auto-approve within budget.',
  'Find protein powder under ₹2,500. Maximum 2 units. No recurring subscriptions.'
];

export default function NewPolicyPage() {
  const [naturalLanguage, setNaturalLanguage] = useState(SAMPLE_PROMPTS[0]);
  const [name, setName] = useState('Running Shoes Protection Policy');
  const [isParsing, setIsParsing] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [parsedData, setParsedData] = useState<PolicyParsedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<any | null>(null);

  const handleParse = async () => {
    if (!naturalLanguage.trim()) return;

    setIsParsing(true);
    setError(null);
    setActivationSuccess(null);

    try {
      const response = await fetchFromApi('/api/v1/policies/parse', {
        method: 'POST',
        body: JSON.stringify({ natural_language: naturalLanguage })
      });

      if (response.success && response.data) {
        setParsedData({
          rules: response.data.parsed_rules,
          explanation: response.data.explanation,
          confidence: response.data.confidence
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse natural language policy.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleActivate = async () => {
    if (!parsedData) return;

    setIsActivating(true);
    setError(null);

    try {
      const response = await fetchFromApi('/api/v1/policies', {
        method: 'POST',
        body: JSON.stringify({
          user_id: 'usr_demo_shopper',
          name: name.trim() || 'Custom Guardian Policy',
          description: naturalLanguage,
          rules: parsedData.rules
        })
      });

      if (response.success) {
        setActivationSuccess(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to activate policy.');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-3 border border-indigo-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Conversational Policy Creator</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Define Your Financial Boundary
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Speak in plain English. PayPal Guardian interprets your intent into deterministic rules that no autonomous agent can bypass.
        </p>
      </div>

      {/* Main Flow */}
      <div className="space-y-6">
        {/* Input Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Policy Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Running Shoes Protection Policy"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Natural Language Instruction
            </label>
            <textarea
              rows={4}
              value={naturalLanguage}
              onChange={(e) => setNaturalLanguage(e.target.value)}
              placeholder="e.g. Buy me running shoes under ₹8,000. Only one pair. No subscriptions. Ask me before paying."
              className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm leading-relaxed"
            />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="mb-6">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              QUICK TEMPLATES:
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNaturalLanguage(prompt)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition text-left"
                >
                  "{prompt.slice(0, 48)}..."
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleParse}
            disabled={isParsing || !naturalLanguage.trim()}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30"
          >
            {isParsing ? (
              <span>Interpreting Rules with AI...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1" />
                <span>Interpret Policy</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-3 text-rose-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Card */}
        {activationSuccess && (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Policy Activated Successfully!</h3>
                <p className="text-xs text-emerald-400">
                  Policy ID: <span className="font-mono">{activationSuccess.policy_id}</span> • Version {activationSuccess.version}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Any AI shopping agent transacting on your behalf is now strictly bound to these rules. The policy engine will deterministically enforce budget limits, quantity ceilings, and subscription locks.
            </p>
          </div>
        )}

        {/* Policy Confirmation Card (Feature 2 in PRD) */}
        {parsedData && !activationSuccess && (
          <PolicyConfirmationCard
            parsedData={parsedData}
            onActivate={handleActivate}
            onEdit={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            isActivating={isActivating}
          />
        )}
      </div>
    </div>
  );
}
