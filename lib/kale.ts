// KALE Token Integration
// Based on KALE's proof-of-teamwork mechanics
// https://github.com/kalepail/KALE-sc

import {
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Memo,
  Transaction,
} from "@stellar/stellar-sdk";
import { server, networkPassphrase, CONTRACT_ADDRESSES } from "./stellar";
import * as FreighterApi from "@stellar/freighter-api";

export interface KaleStakeInfo {
  eventId: number;
  stakerAddress: string;
  stakeAmount: number;
  stakeType: "organizer" | "attendee";
  timestamp: number;
  transactionHash: string;
  status: "active" | "claimed" | "forfeited";
}

export interface KaleRewardInfo {
  eventId: number;
  userAddress: string;
  baseStake: number;
  bonusReward: number;
  totalReward: number;
  attended: boolean;
  claimable: boolean;
}

/**
 * KALE Integration Class
 */
export class KaleIntegration {
  private kaleAsset: Asset;

  constructor() {
    // Validate KALE token issuer address
    if (!CONTRACT_ADDRESSES.KALE_TOKEN) {
      console.warn(
        "KALE token contract address not configured, using native asset"
      );
      this.kaleAsset = Asset.native();
    } else {
      try {
        this.kaleAsset = new Asset("KALE", CONTRACT_ADDRESSES.KALE_TOKEN);
      } catch (error) {
        console.error(
          "Invalid KALE token issuer:",
          CONTRACT_ADDRESSES.KALE_TOKEN,
          error
        );
        console.warn("Falling back to native asset");
        this.kaleAsset = Asset.native();
      }
    }
  }

  /**
   * Get KALE token info
   */
  async getTokenInfo() {
    try {
      const isConfigured = !!CONTRACT_ADDRESSES.KALE_TOKEN;

      return {
        success: true,
        symbol: "KALE",
        name: "KALE Token",
        issuer: CONTRACT_ADDRESSES.KALE_TOKEN || "Not configured",
        decimals: 7,
        totalSupply: 1000000000, // 1B KALE (mock data)
        description: "Proof-of-teamwork meme token for collaborative farming",
        website: "https://kaleonstellar.com",
        documentation: "https://github.com/kalepail/KALE-sc",
        configured: isConfigured,
        status: isConfigured ? "Active" : "Mock Mode - Using XLM for demo",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get user's KALE balance and staking info
   */
  async getUserKaleProfile(userAddress: string) {
    try {
      const account = await server.loadAccount(userAddress);

      let kaleBalance;
      let balance = 0;

      // Check if KALE token is configured
      if (CONTRACT_ADDRESSES.KALE_TOKEN) {
        // Find KALE balance
        kaleBalance = account.balances.find((balance: any) => {
          return (
            balance.asset_code === "KALE" &&
            balance.asset_issuer === CONTRACT_ADDRESSES.KALE_TOKEN
          );
        });
        balance = kaleBalance ? parseFloat(kaleBalance.balance) : 0;
      } else {
        // If no KALE token configured, use XLM balance as mock
        console.warn(
          "KALE token not configured, using XLM balance as mock data"
        );
        const xlmBalance = account.balances.find(
          (b: any) => b.asset_type === "native"
        );
        balance = xlmBalance ? parseFloat(xlmBalance.balance) * 100 : 0; // Mock conversion
      }

      // In production, this would query staking contracts for user's stakes
      const mockStakingData = {
        totalStaked: balance * 0.1, // Mock: 10% of balance is staked
        activeStakes: 2,
        totalRewardsClaimed: balance * 0.05, // Mock: 5% rewards claimed
        pendingRewards: balance * 0.02, // Mock: 2% pending rewards
      };

      return {
        success: true,
        userAddress,
        balance,
        formattedBalance: balance.toFixed(2),
        staking: mockStakingData,
        canStake: balance >= 10, // Minimum stake amount
        stakingPower: this.calculateStakingPower(balance),
        level: this.getUserLevel(balance),
      };
    } catch (error) {
      console.error("Get KALE profile error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Calculate staking power based on balance
   */
  private calculateStakingPower(balance: number): number {
    // Higher balance = more staking power (with diminishing returns)
    return Math.floor(Math.log10(balance + 1) * 100);
  }

  /**
   * Get user level based on KALE balance
   */
  private getUserLevel(balance: number): {
    level: number;
    name: string;
    nextThreshold: number;
  } {
    const levels = [
      { min: 0, level: 1, name: "Seed", nextThreshold: 100 },
      { min: 100, level: 2, name: "Sprout", nextThreshold: 500 },
      { min: 500, level: 3, name: "Leaf", nextThreshold: 1000 },
      { min: 1000, level: 4, name: "Branch", nextThreshold: 5000 },
      { min: 5000, level: 5, name: "Tree", nextThreshold: 10000 },
      { min: 10000, level: 6, name: "Forest", nextThreshold: 50000 },
      { min: 50000, level: 7, name: "Jungle", nextThreshold: Infinity },
    ];

    const userLevel =
      levels.find((l) => balance >= l.min && balance < l.nextThreshold) ||
      levels[0];
    return userLevel;
  }

  /**
   * Stake KALE for event participation
   */
  async stakeForEvent(
    userAddress: string,
    eventId: number,
    stakeAmount: number,
    stakeType: "organizer" | "attendee"
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const minStake = stakeType === "organizer" ? 1000 : 10;

      if (stakeAmount < minStake) {
        throw new Error(`Minimum ${stakeType} stake is ${minStake} KALE`);
      }

      // Check if KALE token is configured
      if (!CONTRACT_ADDRESSES.KALE_TOKEN) {
        console.warn("KALE token not configured, returning mock success");
        return {
          success: true,
          transactionHash: "mock_kale_stake_" + Date.now(),
        };
      }

      // Check user's KALE balance
      const profile = await this.getUserKaleProfile(userAddress);
      if (!profile.success || (profile.balance || 0) < stakeAmount) {
        throw new Error("Insufficient KALE balance");
      }

      const account = await server.loadAccount(userAddress);

      // Create staking transaction
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination:
              CONTRACT_ADDRESSES.KALE_STAKING ||
              CONTRACT_ADDRESSES.KAIZEN_EVENT ||
              userAddress, // Fallback to self if no staking contract
            asset: this.kaleAsset,
            amount: stakeAmount.toString(),
          })
        )
        .addMemo(Memo.text(`KALE_STAKE_${eventId}_${stakeType.toUpperCase()}`))
        .setTimeout(0)
        .build();

      // Sign with Freighter
      const { signedTxXdr } = await FreighterApi.signTransaction(
        transaction.toXDR(),
        { networkPassphrase, address: userAddress }
      );

      // Submit transaction
      const signedTransaction = new Transaction(signedTxXdr, networkPassphrase);
      const result = await server.submitTransaction(signedTransaction);

      if (result.successful) {
        return {
          success: true,
          transactionHash: result.hash,
        };
      } else {
        throw new Error("Staking transaction failed");
      }
    } catch (error) {
      console.error("KALE staking error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Calculate rewards for event participation
   */
  calculateEventRewards(
    eventId: number,
    organizerStake: number,
    attendeeStakes: number[],
    actualAttendees: number
  ): KaleRewardInfo[] {
    const totalAttendeeStakes = attendeeStakes.reduce(
      (sum, stake) => sum + stake,
      0
    );
    const rewardPool = organizerStake * 0.1; // 10% of organizer stake goes to reward pool
    const bonusPerAttendee = rewardPool / Math.max(actualAttendees, 1);

    return attendeeStakes.map((stake, index) => ({
      eventId,
      userAddress: `MOCK_USER_${index}`,
      baseStake: stake,
      bonusReward: bonusPerAttendee,
      totalReward: stake + bonusPerAttendee, // Get stake back + bonus
      attended: index < actualAttendees, // Mock attendance
      claimable: index < actualAttendees,
    }));
  }

  /**
   * Get event staking statistics
   */
  async getEventStakingStats(eventId: number) {
    try {
      // In production, this would query actual staking contract data
      const mockStats = {
        eventId,
        organizerStake: 1000,
        attendeeStakes: [10, 15, 20, 25, 10, 30], // Mock attendee stakes
        totalStaked: 1110,
        expectedAttendees: 6,
        actualAttendees: 4, // Mock: 2 no-shows
        rewardPool: 100, // 10% of organizer stake
        distributedRewards: 80, // Rewards for 4 actual attendees
        forfeitedStakes: 25, // Stakes lost by 2 no-shows
        stakingDeadline: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
        eventStatus: "active" as
          | "pending"
          | "active"
          | "completed"
          | "cancelled",
      };

      return {
        success: true,
        ...mockStats,
      };
    } catch (error) {
      console.error("Get staking stats error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Claim rewards after event completion
   */
  async claimEventRewards(
    userAddress: string,
    eventId: number,
    attended: boolean = true
  ) {
    try {
      if (!attended) {
        return {
          success: false,
          error: "Cannot claim rewards - attendance not verified",
        };
      }

      // In production, this would call the staking contract to claim rewards
      // For now, simulate the reward claim

      const mockReward = {
        baseStake: 10, // User's original stake
        bonus: 25, // Bonus from organizer's reward pool
        total: 35, // Total claimable amount
      };

      console.log(`Claiming KALE rewards for event ${eventId}:`, {
        userAddress,
        attended,
        reward: mockReward,
      });

      return {
        success: true,
        transactionHash: "mock_claim_" + Date.now(),
        claimedAmount: mockReward.total,
        breakdown: mockReward,
      };
    } catch (error) {
      console.error("Claim KALE rewards error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get KALE farming opportunities (integrate with KALE's mining)
   */
  async getFarmingOpportunities() {
    try {
      // Mock farming data - in production, this would connect to KALE's mining contracts
      const opportunities = [
        {
          id: "web-mining",
          name: "Web Mining",
          description: "Mine KALE tokens using your browser",
          apy: 12.5,
          minimumStake: 0,
          currentMiners: 1205,
          difficulty: "Easy",
          url: "https://testnet.kalefarm.xyz/",
        },
        {
          id: "gpu-mining",
          name: "GPU Mining",
          description: "High-performance mining with GPU",
          apy: 25.8,
          minimumStake: 100,
          currentMiners: 89,
          difficulty: "Advanced",
          url: "https://github.com/kalepail/KALE-sc",
        },
        {
          id: "mobile-mining",
          name: "Mobile Mining",
          description: "Mine KALE on your phone",
          apy: 8.2,
          minimumStake: 0,
          currentMiners: 2341,
          difficulty: "Easy",
          url: "https://kaleonstellar.com",
        },
      ];

      return {
        success: true,
        opportunities,
        totalMiners: opportunities.reduce(
          (sum, opp) => sum + opp.currentMiners,
          0
        ),
      };
    } catch (error) {
      console.error("Get farming opportunities error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const kaleIntegration = new KaleIntegration();

// Utility functions
export const formatKaleAmount = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M KALE`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K KALE`;
  } else {
    return `${amount.toFixed(2)} KALE`;
  }
};

export const calculateAPY = (
  rewards: number,
  stake: number,
  days: number
): number => {
  if (stake === 0 || days === 0) return 0;
  const dailyReturn = rewards / stake / days;
  return (Math.pow(1 + dailyReturn, 365) - 1) * 100;
};

export const getStakingRisk = (
  stakeAmount: number
): "Low" | "Medium" | "High" => {
  if (stakeAmount <= 50) return "Low";
  if (stakeAmount <= 500) return "Medium";
  return "High";
};
