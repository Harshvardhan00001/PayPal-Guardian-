import { SnapshotHasher } from '../crypto/snapshot-hasher.js';
import { CartProposal } from '../policy-engine/types.js';

export class TamperDetectedError extends Error {
  public code = 'ORDER_CHANGED';
  public expectedHash: string;
  public actualHash: string;

  constructor(message: string, expectedHash: string, actualHash: string) {
    super(message);
    this.name = 'TamperDetectedError';
    this.expectedHash = expectedHash;
    this.actualHash = actualHash;
  }
}

export class ApprovalExpiredError extends Error {
  public code = 'APPROVAL_EXPIRED';
  public expiredAt: Date;

  constructor(message: string, expiredAt: Date) {
    super(message);
    this.name = 'ApprovalExpiredError';
    this.expiredAt = expiredAt;
  }
}

export class TamperGuard {
  /**
   * Asserts that a cart proposal strictly matches the approved snapshot hash.
   * Throws TamperDetectedError if any cart attribute was mutated after approval.
   */
  public static assertSnapshotIntegrity(currentCart: CartProposal, approvedHash: string): string {
    const currentHash = SnapshotHasher.computeHash(currentCart);

    if (currentHash.toLowerCase() !== approvedHash.trim().toLowerCase()) {
      throw new TamperDetectedError(
        'Order snapshot modified after user approval. Prior authorization has been invalidated.',
        approvedHash,
        currentHash
      );
    }

    return currentHash;
  }

  /**
   * Asserts that an approval session has not elapsed.
   */
  public static assertApprovalNotExpired(expiresAt: Date): void {
    const now = new Date();
    if (now > expiresAt) {
      throw new ApprovalExpiredError('The approval session for this order has expired.', expiresAt);
    }
  }
}
