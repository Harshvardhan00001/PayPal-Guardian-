import { db } from '../../db/prisma.js';
import { CreatePolicyInput } from './policies.schema.js';
import { PolicyRules } from '../../core/policy-engine/types.js';

export class PolicyService {
  /**
   * Persists a new policy and creates its initial version (v1).
   */
  public static async createPolicy(input: CreatePolicyInput) {
    const userId = input.user_id || 'usr_demo_shopper';

    // Verify user exists or fallback to demo
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`User with ID '${userId}' not found. Ensure database is seeded.`);
    }

    const policy = await db.policy.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        status: 'ACTIVE',
        versions: {
          create: {
            version: 1,
            rulesJson: JSON.stringify(input.rules)
          }
        }
      },
      include: {
        versions: true
      }
    });

    // Write forensic audit event
    await db.auditEvent.create({
      data: {
        userId,
        eventType: 'POLICY_CREATED',
        actor: 'USER',
        metadata: JSON.stringify({
          policy_id: policy.id,
          version: 1,
          rules: input.rules
        })
      }
    });

    return {
      policy_id: policy.id,
      version: 1,
      name: policy.name,
      description: policy.description,
      status: policy.status,
      rules: input.rules,
      created_at: policy.createdAt
    };
  }

  /**
   * Lists policies with their active rules.
   */
  public static async listPolicies(userId?: string) {
    const filter = userId ? { userId } : {};

    const policies = await db.policy.findMany({
      where: filter,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return policies.map((p) => {
      const activeVersion = p.versions[0];
      let rules: PolicyRules | null = null;
      if (activeVersion?.rulesJson) {
        try {
          rules = JSON.parse(activeVersion.rulesJson);
        } catch {
          rules = null;
        }
      }

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        version: activeVersion?.version || 1,
        rules,
        created_at: p.createdAt,
        updated_at: p.updatedAt
      };
    });
  }

  /**
   * Retrieves single policy details including version history.
   */
  public static async getPolicyById(id: string) {
    const policy = await db.policy.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' }
        }
      }
    });

    if (!policy) {
      return null;
    }

    const versions = policy.versions.map((v) => ({
      version: v.version,
      rules: JSON.parse(v.rulesJson),
      created_at: v.createdAt
    }));

    return {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      status: policy.status,
      active_rules: versions[0]?.rules || null,
      version_history: versions,
      created_at: policy.createdAt,
      updated_at: policy.updatedAt
    };
  }
}
