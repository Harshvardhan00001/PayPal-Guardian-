import { db } from '../../db/prisma.js';
import { CreateProposalInput, MutateProposalInput } from './transactions.schema.js';
import { SnapshotHasher } from '../../core/crypto/snapshot-hasher.js';
import { DeterministicPolicyEngine } from '../../core/policy-engine/evaluator.js';
import { CartProposal, PolicyRules } from '../../core/policy-engine/types.js';
import { TamperGuard, TamperDetectedError } from '../../core/security/tamper-guard.js';

export class TransactionsService {
  /**
   * Ingests a new AI shopping cart proposal and executes deterministic policy evaluation.
   */
  public static async createProposal(input: CreateProposalInput) {
    const userId = input.user_id || 'usr_demo_shopper';

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`User with ID '${userId}' not found.`);
    }

    // Verify policy exists and is ACTIVE
    const policy = await db.policy.findUnique({
      where: { id: input.policy_id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    if (!policy || policy.status !== 'ACTIVE') {
      throw new Error(`Active policy with ID '${input.policy_id}' not found.`);
    }

    const latestVersion = policy.versions[0];
    if (!latestVersion) {
      throw new Error(`Policy '${input.policy_id}' has no configured version.`);
    }

    const policyRules: PolicyRules = JSON.parse(latestVersion.rulesJson);

    // Calculate subtotal and total
    const subtotal = input.items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
    const total = subtotal + input.shipping + input.tax + input.fees;

    // Build CartProposal
    const cartProposal: CartProposal = {
      merchant: input.merchant,
      currency: input.currency.toUpperCase(),
      items: input.items.map((i) => ({
        sku: i.sku || 'N/A',
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: Number((i.quantity * i.unit_price).toFixed(2))
      })),
      subtotal: Number(subtotal.toFixed(2)),
      shipping: Number(input.shipping.toFixed(2)),
      tax: Number(input.tax.toFixed(2)),
      fees: Number(input.fees.toFixed(2)),
      total: Number(total.toFixed(2)),
      recurring: Boolean(input.recurring)
    };

    // Compute canonical snapshot hash
    const snapshotHash = SnapshotHasher.computeHash(cartProposal);

    // Execute deterministic evaluation (Zero LLM)
    const evalResult = DeterministicPolicyEngine.evaluate(policyRules, cartProposal);
    const status = evalResult.decision; // ALLOW, ASK, or BLOCK
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min expiration

    // Persist Proposal in Database
    const proposal = await db.transactionProposal.create({
      data: {
        userId,
        policyId: policy.id,
        policyVersion: latestVersion.version,
        merchant: cartProposal.merchant,
        currency: cartProposal.currency,
        subtotal: cartProposal.subtotal,
        shipping: cartProposal.shipping,
        tax: cartProposal.tax,
        fees: cartProposal.fees,
        total: cartProposal.total,
        recurring: cartProposal.recurring,
        status,
        snapshotHash,
        expiresAt,
        items: {
          create: cartProposal.items.map((i) => ({
            sku: i.sku,
            name: i.name,
            category: i.category,
            quantity: i.quantity,
            unitPrice: i.unit_price,
            totalPrice: i.unit_price * i.quantity
          }))
        },
        evaluations: {
          create: {
            decision: evalResult.decision,
            reasonCodes: JSON.stringify(evalResult.reasons),
            riskSignals: JSON.stringify({ passed_checks: evalResult.passed_checks })
          }
        }
      },
      include: {
        items: true,
        evaluations: true
      }
    });

    // Write Audit Events
    await db.auditEvent.createMany({
      data: [
        {
          userId,
          transactionId: proposal.id,
          eventType: 'ORDER_PROPOSED',
          actor: 'AI_AGENT',
          metadata: JSON.stringify({
            merchant: cartProposal.merchant,
            total: cartProposal.total,
            currency: cartProposal.currency,
            snapshot_hash: snapshotHash
          })
        },
        {
          userId,
          transactionId: proposal.id,
          eventType: 'POLICY_EVALUATED',
          actor: 'POLICY_ENGINE',
          metadata: JSON.stringify({
            decision: evalResult.decision,
            reasons: evalResult.reasons,
            passed_checks: evalResult.passed_checks
          })
        }
      ]
    });

    return {
      transaction_id: proposal.id,
      status: proposal.status,
      decision: evalResult.decision,
      snapshot_hash: snapshotHash,
      summary: {
        merchant: cartProposal.merchant,
        currency: cartProposal.currency,
        subtotal: cartProposal.subtotal,
        shipping: cartProposal.shipping,
        tax: cartProposal.tax,
        fees: cartProposal.fees,
        total: cartProposal.total,
        recurring: cartProposal.recurring
      },
      items: cartProposal.items,
      reasons: evalResult.reasons,
      passed_checks: evalResult.passed_checks,
      expires_at: proposal.expiresAt,
      created_at: proposal.createdAt
    };
  }

  /**
   * Retrieves single transaction proposal details and checks current hash integrity.
   */
  public static async getTransactionById(id: string) {
    const proposal = await db.transactionProposal.findUnique({
      where: { id },
      include: {
        items: true,
        evaluations: { orderBy: { evaluatedAt: 'desc' } },
        approvals: { orderBy: { approvedAt: 'desc' } },
        paypalOrders: true,
        policy: true
      }
    });

    if (!proposal) {
      return null;
    }

    // Reconstruct CartProposal to calculate live hash
    const currentCart: CartProposal = {
      merchant: proposal.merchant,
      currency: proposal.currency,
      items: proposal.items.map((i) => ({
        sku: i.sku || 'N/A',
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit_price: Number(i.unitPrice),
        total_price: Number(i.totalPrice)
      })),
      subtotal: Number(proposal.subtotal),
      shipping: Number(proposal.shipping),
      tax: Number(proposal.tax),
      fees: Number(proposal.fees),
      total: Number(proposal.total),
      recurring: proposal.recurring
    };

    const currentHash = SnapshotHasher.computeHash(currentCart);
    const latestEvaluation = proposal.evaluations[0];
    const latestApproval = proposal.approvals[0];

    return {
      id: proposal.id,
      user_id: proposal.userId,
      policy_id: proposal.policyId,
      policy_name: proposal.policy.name,
      status: proposal.status,
      snapshot_hash: proposal.snapshotHash,
      current_hash: currentHash,
      is_hash_intact: currentHash.toLowerCase() === proposal.snapshotHash.toLowerCase(),
      merchant: proposal.merchant,
      currency: proposal.currency,
      subtotal: Number(proposal.subtotal),
      shipping: Number(proposal.shipping),
      tax: Number(proposal.tax),
      fees: Number(proposal.fees),
      total: Number(proposal.total),
      recurring: proposal.recurring,
      items: proposal.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit_price: Number(i.unitPrice),
        total_price: Number(i.totalPrice)
      })),
      evaluation: latestEvaluation
        ? {
            decision: latestEvaluation.decision,
            reasons: JSON.parse(latestEvaluation.reasonCodes),
            risk_signals: JSON.parse(latestEvaluation.riskSignals),
            evaluated_at: latestEvaluation.evaluatedAt
          }
        : null,
      approval: latestApproval
        ? {
            snapshot_hash: latestApproval.snapshotHash,
            approved_at: latestApproval.approvedAt,
            expires_at: latestApproval.expiresAt
          }
        : null,
      paypal_order: proposal.paypalOrders[0] || null,
      expires_at: proposal.expiresAt,
      created_at: proposal.createdAt,
      updated_at: proposal.updatedAt
    };
  }

  /**
   * Lists all transaction proposals.
   */
  public static async listTransactions(userId?: string) {
    const filter = userId ? { userId } : {};

    const proposals = await db.transactionProposal.findMany({
      where: filter,
      include: {
        policy: true,
        evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    });

    return proposals.map((p) => ({
      id: p.id,
      merchant: p.merchant,
      currency: p.currency,
      total: Number(p.total),
      status: p.status,
      policy_name: p.policy.name,
      decision: p.evaluations[0]?.decision || 'UNKNOWN',
      snapshot_hash: p.snapshotHash,
      created_at: p.createdAt
    }));
  }

  /**
   * User approves the exact proposed transaction snapshot.
   */
  public static async approveTransaction(id: string, userId: string, snapshotHash: string) {
    const proposal = await db.transactionProposal.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!proposal) {
      throw new Error(`Transaction proposal '${id}' not found.`);
    }

    if (proposal.status === 'BLOCK' || proposal.status === 'BLOCKED') {
      throw new Error('Cannot approve a transaction that violates mandatory policy bounds.');
    }

    if (proposal.status === 'COMPLETED') {
      throw new Error('Transaction has already been finalized.');
    }

    if (proposal.status === 'ORDER_CHANGED') {
      throw new Error('Transaction order was modified and requires re-evaluation before approval.');
    }

    // Verify snapshot hash match
    const currentCart: CartProposal = {
      merchant: proposal.merchant,
      currency: proposal.currency,
      items: proposal.items.map((i) => ({
        sku: i.sku || 'N/A',
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit_price: Number(i.unitPrice)
      })),
      subtotal: Number(proposal.subtotal),
      shipping: Number(proposal.shipping),
      tax: Number(proposal.tax),
      fees: Number(proposal.fees),
      total: Number(proposal.total),
      recurring: proposal.recurring
    };

    const computedHash = SnapshotHasher.computeHash(currentCart);

    if (computedHash.toLowerCase() !== snapshotHash.trim().toLowerCase()) {
      throw new Error(
        `Hash mismatch. Provided snapshot hash '${snapshotHash}' does not match current cart hash '${computedHash}'.`
      );
    }

    // Check expiration
    if (new Date() > proposal.expiresAt) {
      throw new Error('This transaction proposal has expired.');
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute approval window

    // Persist Approval and update proposal status
    const approval = await db.approval.upsert({
      where: {
        transactionId_snapshotHash: {
          transactionId: id,
          snapshotHash: computedHash
        }
      },
      update: {
        approvedAt: new Date(),
        expiresAt
      },
      create: {
        transactionId: id,
        userId: userId || proposal.userId,
        snapshotHash: computedHash,
        expiresAt
      }
    });

    await db.transactionProposal.update({
      where: { id },
      data: { status: 'USER_APPROVED' }
    });

    // Forensic audit event
    await db.auditEvent.create({
      data: {
        userId: userId || proposal.userId,
        transactionId: id,
        eventType: 'USER_APPROVED',
        actor: 'USER',
        metadata: JSON.stringify({
          snapshot_hash: computedHash,
          approved_at: approval.approvedAt,
          expires_at: approval.expiresAt
        })
      }
    });

    return {
      transaction_id: id,
      status: 'USER_APPROVED',
      snapshot_hash: computedHash,
      approved_at: approval.approvedAt,
      expires_at: approval.expiresAt
    };
  }

  /**
   * User rejects the transaction proposal.
   */
  public static async rejectTransaction(id: string, userId: string, reason: string) {
    const proposal = await db.transactionProposal.findUnique({ where: { id } });
    if (!proposal) {
      throw new Error(`Transaction proposal '${id}' not found.`);
    }

    await db.transactionProposal.update({
      where: { id },
      data: { status: 'USER_REJECTED' }
    });

    await db.auditEvent.create({
      data: {
        userId: userId || proposal.userId,
        transactionId: id,
        eventType: 'USER_REJECTED',
        actor: 'USER',
        metadata: JSON.stringify({ reason })
      }
    });

    return {
      transaction_id: id,
      status: 'USER_REJECTED',
      reason
    };
  }

  /**
   * Simulates/executes order mutation (used for tamper testing and cart updates).
   * If altered after user approval, automatically flags ORDER_CHANGED and revokes approval.
   */
  public static async mutateProposal(id: string, modifications: MutateProposalInput) {
    const existing = await db.transactionProposal.findUnique({
      where: { id },
      include: {
        items: true,
        approvals: { orderBy: { approvedAt: 'desc' }, take: 1 },
        policy: {
          include: {
            versions: { orderBy: { version: 'desc' }, take: 1 }
          }
        }
      }
    });

    if (!existing) {
      throw new Error(`Transaction '${id}' not found.`);
    }

    const hadApproval = existing.approvals.length > 0 && existing.status === 'USER_APPROVED';
    const priorApprovedHash = existing.approvals[0]?.snapshotHash;

    // Apply modifications
    const newMerchant = modifications.merchant || existing.merchant;
    const newCurrency = modifications.currency || existing.currency;
    const newRecurring = modifications.recurring !== undefined ? modifications.recurring : existing.recurring;
    const newShipping = modifications.shipping !== undefined ? modifications.shipping : Number(existing.shipping);
    const newTax = modifications.tax !== undefined ? modifications.tax : Number(existing.tax);
    const newFees = modifications.fees !== undefined ? modifications.fees : Number(existing.fees);

    let updatedItems = existing.items.map((i) => ({
      sku: i.sku || 'N/A',
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      unit_price: Number(i.unitPrice)
    }));

    if (modifications.items && modifications.items.length > 0) {
      updatedItems = modifications.items.map((i) => ({
        sku: i.sku || 'N/A',
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit_price: i.unit_price
      }));
    }

    const subtotal = updatedItems.reduce((acc, i) => acc + i.quantity * i.unit_price, 0);
    const total = subtotal + newShipping + newTax + newFees;

    const mutatedCart: CartProposal = {
      merchant: newMerchant,
      currency: newCurrency,
      items: updatedItems,
      subtotal: Number(subtotal.toFixed(2)),
      shipping: Number(newShipping.toFixed(2)),
      tax: Number(newTax.toFixed(2)),
      fees: Number(newFees.toFixed(2)),
      total: Number(total.toFixed(2)),
      recurring: newRecurring
    };

    const newHash = SnapshotHasher.computeHash(mutatedCart);

    // Check if tampered after approval
    let newStatus = existing.status;
    let isTampered = false;

    if (hadApproval && priorApprovedHash && priorApprovedHash.toLowerCase() !== newHash.toLowerCase()) {
      newStatus = 'ORDER_CHANGED';
      isTampered = true;

      // Invalidate approval
      await db.approval.deleteMany({ where: { transactionId: id } });

      // Log security event
      await db.auditEvent.create({
        data: {
          userId: existing.userId,
          transactionId: id,
          eventType: 'ORDER_TAMPERING_DETECTED',
          actor: 'POLICY_ENGINE',
          metadata: JSON.stringify({
            reason: 'Cart contents or price modified after human approval',
            previous_approved_hash: priorApprovedHash,
            mutated_hash: newHash,
            tampered_total: total
          })
        }
      });
    }

    // Re-evaluate against active policy
    const policyRules: PolicyRules = JSON.parse(existing.policy.versions[0].rulesJson);
    const evalResult = DeterministicPolicyEngine.evaluate(policyRules, mutatedCart);

    if (!isTampered) {
      newStatus = evalResult.decision;
    }

    // Update database records
    await db.transactionItem.deleteMany({ where: { transactionId: id } });

    await db.transactionProposal.update({
      where: { id },
      data: {
        merchant: newMerchant,
        currency: newCurrency,
        subtotal,
        shipping: newShipping,
        tax: newTax,
        fees: newFees,
        total,
        recurring: newRecurring,
        snapshotHash: newHash,
        status: newStatus,
        items: {
          create: updatedItems.map((i) => ({
            sku: i.sku,
            name: i.name,
            category: i.category,
            quantity: i.quantity,
            unitPrice: i.unit_price,
            totalPrice: i.unit_price * i.quantity
          }))
        },
        evaluations: {
          create: {
            decision: evalResult.decision,
            reasonCodes: JSON.stringify(evalResult.reasons),
            riskSignals: JSON.stringify({ is_tampered: isTampered })
          }
        }
      }
    });

    return {
      transaction_id: id,
      status: newStatus,
      is_tampered: isTampered,
      previous_hash: priorApprovedHash || null,
      new_snapshot_hash: newHash,
      new_total: total,
      decision: evalResult.decision,
      reasons: isTampered
        ? [
            {
              code: 'ORDER_CHANGED',
              message: 'Cart snapshot changed after approval. Prior authorization revoked.'
            },
            ...evalResult.reasons
          ]
        : evalResult.reasons
    };
  }
}
