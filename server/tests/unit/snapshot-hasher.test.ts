import { describe, it, expect } from 'vitest';
import { SnapshotHasher } from '../../src/core/crypto/snapshot-hasher.js';
import { CartProposal } from '../../src/core/policy-engine/types.js';

describe('SnapshotHasher Tests', () => {
  const proposalA: CartProposal = {
    merchant: 'Nike Store',
    currency: 'INR',
    items: [
      {
        sku: 'NK-01',
        name: 'Pegasus 40',
        category: 'running_shoes',
        quantity: 1,
        unit_price: 7499
      }
    ],
    subtotal: 7499,
    shipping: 0,
    tax: 0,
    fees: 0,
    total: 7499,
    recurring: false
  };

  it('Generates a deterministic 64-character hex hash', () => {
    const hash = SnapshotHasher.computeHash(proposalA);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('Produces identical hash for identical semantic cart regardless of object key order', () => {
    const hash1 = SnapshotHasher.computeHash(proposalA);

    // Permuted property order
    const proposalReordered: CartProposal = {
      recurring: false,
      total: 7499,
      shipping: 0,
      currency: 'INR',
      merchant: 'Nike Store',
      tax: 0,
      subtotal: 7499,
      fees: 0,
      items: [
        {
          quantity: 1,
          name: 'Pegasus 40',
          unit_price: 7499,
          category: 'running_shoes',
          sku: 'NK-01'
        }
      ]
    };

    const hash2 = SnapshotHasher.computeHash(proposalReordered);
    expect(hash1).toBe(hash2);
    expect(SnapshotHasher.verifyMatch(proposalReordered, hash1)).toBe(true);
  });

  it('Detects tamper: Changing total amount by 1 cent alters the hash', () => {
    const originalHash = SnapshotHasher.computeHash(proposalA);
    const tamperedProposal: CartProposal = {
      ...proposalA,
      total: 7499.01
    };

    const tamperedHash = SnapshotHasher.computeHash(tamperedProposal);
    expect(originalHash).not.toBe(tamperedHash);
    expect(SnapshotHasher.verifyMatch(tamperedProposal, originalHash)).toBe(false);
  });

  it('Detects tamper: Adding a recurring subscription item alters the hash', () => {
    const originalHash = SnapshotHasher.computeHash(proposalA);
    const subscriptionProposal: CartProposal = {
      ...proposalA,
      recurring: true,
      items: [
        ...proposalA.items,
        {
          sku: 'VIP-SUB',
          name: 'VIP Club',
          category: 'subscription',
          quantity: 1,
          unit_price: 499
        }
      ],
      total: 7998
    };

    const subscriptionHash = SnapshotHasher.computeHash(subscriptionProposal);
    expect(originalHash).not.toBe(subscriptionHash);
    expect(SnapshotHasher.verifyMatch(subscriptionProposal, originalHash)).toBe(false);
  });
});
