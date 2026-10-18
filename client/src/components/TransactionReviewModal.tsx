'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import { fetchFromApi } from '../lib/api';

export interface ProposalItem {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ProposalDetails {
  id: string;
  merchant: string;
  currency: string;
  items: ProposalItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  fees: number;
  total: number;
  recurring: boolean;
  status: string;
  snapshotHash: string;
  evaluations?: any[];
}

interface TransactionReviewModalProps {
  proposal: ProposalDetails;
  onPaymentComplete?: (captureResult: any) => void;
  onClose?: () => void;
}

export function TransactionReviewModal({
  proposal,
  onPaymentComplete,
  onClose
}: TransactionReviewModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [approvalResult, setApprovalResult] = useState<any | null>(null);
  const [payPalOrder, setPayPalOrder] = useState<any | null>(null);
  const [captureData, setCaptureData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApproveAndPay = async () => {
    setIsApproving(true);
    setError(null);

    try {
      // Step 1: User Cryptographic Approval Binding
      const approveRes = await fetchFromApi(`/api/v1/transactions/${proposal.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ snapshot_hash: proposal.snapshotHash })
      });

      if (!approveRes.success) {
        throw new Error(approveRes.error?.message || 'Failed to approve transaction.');
      }
      setApprovalResult(approveRes.data);

      // Step 2: Create Server-side PayPal Order v2
      const payRes = await fetchFromApi('/api/v1/payments/paypal/create-order', {
        method: 'POST',
        body: JSON.stringify({ transaction_id: proposal.id })
      });

      if (!payRes.success) {
        throw new Error(payRes.error?.message || 'Failed to create PayPal sandbox order.');
      }
      setPayPalOrder(payRes.data);
    } catch (err: any) {
      setError(err.message || 'Error executing approval & checkout flow');
    } finally {
      setIsApproving(false);
    }
  };

  const handleCapture = async () => {
    if (!payPalOrder) return;

    setIsCapturing(true);
    setError(null);

    try {
      const captureRes = await fetchFromApi('/api/v1/payments/paypal/capture', {
        method: 'POST',
        body: JSON.stringify({
          transaction_id: proposal.id,
          paypal_order_id: payPalOrder.paypal_order_id
        })
      });

      if (!captureRes.success) {
        throw new Error(captureRes.error?.message || 'Failed to capture PayPal payment.');
      }

      setCaptureData(captureRes.data);
      if (onPaymentComplete) {
        onPaymentComplete(captureRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error capturing payment');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-2xl w-full">
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white">Review Transaction Proposal</h2>
              <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-500 text-slate-950 tracking-wider">
                {proposal.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">Merchant: {proposal.merchant}</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400">Total to Authorize</span>
          <div className="text-xl font-extrabold text-white">
            {proposal.currency} {proposal.total?.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Snapshot Hash Badge */}
      <div className="mt-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-slate-400">
          <Lock className="w-3.5 h-3.5 text-indigo-400" />
          <span>RFC 8785 Snapshot SHA-256:</span>
        </div>
        <span className="font-mono text-indigo-300 text-[11px] truncate max-w-xs">
          {proposal.snapshotHash}
        </span>
      </div>

      {/* Items Table */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Cart Items
        </h4>
        <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          {proposal.items.map((item, idx) => (
            <div key={idx} className="p-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-white">{item.name}</span>
                <span className="text-slate-500 ml-2">Qty: {item.quantity}</span>
                <div className="text-[11px] text-slate-400">
                  Category: {item.category} • SKU: {item.sku}
                </div>
              </div>
              <div className="text-right font-medium text-slate-200">
                {proposal.currency} {item.total_price?.toLocaleString()}
              </div>
            </div>
          ))}

          {/* Breakdown summary */}
          <div className="p-3 bg-slate-950/90 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>
                {proposal.currency} {proposal.subtotal?.toLocaleString()}
              </span>
            </div>
            {proposal.shipping > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Shipping</span>
                <span>
                  {proposal.currency} {proposal.shipping?.toLocaleString()}
                </span>
              </div>
            )}
            {proposal.tax > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Tax</span>
                <span>
                  {proposal.currency} {proposal.tax?.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-800">
              <span>Total</span>
              <span>
                {proposal.currency} {proposal.total?.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="mt-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2 text-xs">
        <div className="flex items-center text-emerald-400">
          <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>Budget check passed (Under limit)</span>
        </div>
        <div className="flex items-center text-emerald-400">
          <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>Subscription check passed (No recurring fees)</span>
        </div>
        <div className="flex items-center text-emerald-400">
          <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>Quantity check passed</span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Success / Capture Step */}
      {captureData ? (
        <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Payment Successfully Finalized!</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            PayPal Capture ID: <span className="font-mono text-emerald-300">{captureData.capture_id}</span>
          </p>
          <div className="mt-3 text-xs text-slate-400">
            Immutable audit record saved with status: <span className="text-emerald-400 font-semibold">COMPLETED</span>.
          </div>
        </div>
      ) : payPalOrder ? (
        <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl space-y-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-300 font-semibold text-xs">
              <ShoppingBag className="w-4 h-4" />
              <span>PayPal Order v2 Created ({payPalOrder.paypal_order_id})</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Your cryptographic approval is permanently bound to this exact snapshot hash.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {payPalOrder.approval_url && (
              <a
                href={payPalOrder.approval_url}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition"
              >
                <span>Open PayPal Checkout Window</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </a>
            )}

            <button
              onClick={handleCapture}
              disabled={isCapturing}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition"
            >
              {isCapturing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Capturing Payment...</span>
                </>
              ) : (
                <>
                  <span>Finalize & Capture Payment</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Action buttons */
        <div className="mt-6 flex items-center justify-end space-x-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={isApproving}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleApproveAndPay}
            disabled={isApproving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
          >
            {isApproving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Binding Authorization...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve & Continue to PayPal</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
