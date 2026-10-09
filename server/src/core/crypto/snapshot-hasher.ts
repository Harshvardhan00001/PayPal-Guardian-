import { createHash } from 'node:crypto';
import { CartProposal } from '../policy-engine/types.js';

export class SnapshotHasher {
  /**
   * Produces an immutable, deterministic RFC 8785 canonical JSON representation of the cart proposal.
   * - Sorted dictionary keys
   * - Deterministic item array ordering (sorted by sku/name)
   * - Normalized monetary float precision (2 decimals)
   * - Stripped arbitrary whitespaces
   */
  public static canonicalize(proposal: CartProposal): string {
    const normalizedItems = [...proposal.items]
      .sort((a, b) => (a.sku || a.name).localeCompare(b.sku || b.name))
      .map((item) => ({
        category: item.category.trim().toLowerCase(),
        name: item.name.trim(),
        quantity: item.quantity,
        sku: (item.sku || '').trim(),
        unit_price: Number(item.unit_price.toFixed(2))
      }));

    const canonicalObject = {
      currency: proposal.currency.trim().toUpperCase(),
      fees: Number(proposal.fees.toFixed(2)),
      items: normalizedItems,
      merchant: proposal.merchant.trim().toLowerCase(),
      recurring: Boolean(proposal.recurring),
      shipping: Number(proposal.shipping.toFixed(2)),
      subtotal: Number(proposal.subtotal.toFixed(2)),
      tax: Number(proposal.tax.toFixed(2)),
      total: Number(proposal.total.toFixed(2))
    };

    // Deterministically serialize with sorted keys
    return JSON.stringify(canonicalObject, Object.keys(canonicalObject).sort());
  }

  /**
   * Computes the 64-character SHA-256 hex digest of the canonical snapshot.
   */
  public static computeHash(proposal: CartProposal): string {
    const canonicalString = this.canonicalize(proposal);
    return createHash('sha256').update(canonicalString, 'utf8').digest('hex');
  }

  /**
   * Verifies if a given proposal matches the expected snapshot hash.
   */
  public static verifyMatch(proposal: CartProposal, expectedHash: string): boolean {
    const currentHash = this.computeHash(proposal);
    return currentHash.toLowerCase() === expectedHash.trim().toLowerCase();
  }
}
