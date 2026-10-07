import React from 'react';
import { ShieldCheck, Lock, Activity, Bot, ArrowRight, ExternalLink } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-12 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              PayPal Guardian
            </h1>
            <p className="text-xs text-slate-400 font-medium">The firewall between AI and your money</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2"></span>
            System Online (v1.0.0)
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="my-auto py-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-indigo-400 font-mono mb-6">
            <Lock className="w-3.5 h-3.5" />
            <span>Deterministic Policy & Authorization Gateway</span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-6">
            Give AI agents financial autonomy,{' '}
            <span className="text-indigo-400">never unlimited authority.</span>
          </h2>

          <p className="text-lg text-slate-300 leading-relaxed mb-8">
            Guardian converts natural language spending policies into immutable boundaries, evaluates proposed carts deterministically, locks approval states with SHA-256 snapshot hashes, and authorizes checkout via PayPal Sandbox.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <Bot className="w-6 h-6 text-indigo-400 mb-2" />
              <h3 className="font-semibold text-white text-sm">Autonomous Proposals</h3>
              <p className="text-xs text-slate-400 mt-1">Agents submit structured carts for independent evaluation.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <ShieldCheck className="w-6 h-6 text-emerald-400 mb-2" />
              <h3 className="font-semibold text-white text-sm">Deterministic Engine</h3>
              <p className="text-xs text-slate-400 mt-1">Zero LLM payment decisions. 100% mathematical rules.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <Lock className="w-6 h-6 text-amber-400 mb-2" />
              <h3 className="font-semibold text-white text-sm">Tamper-Proof Hashes</h3>
              <p className="text-xs text-slate-400 mt-1">Any modification after approval immediately invalidates payment.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
        <p>© 2026 PayPal Guardian. Built for AI Agentic Commerce Hackathon.</p>
        <div className="flex space-x-6 mt-4 sm:mt-0">
          <span className="text-slate-400">Target: PayPal Orders v2 Sandbox</span>
          <span className="text-slate-400">Engine: Fastify + Prisma + Next.js</span>
        </div>
      </footer>
    </div>
  );
}
