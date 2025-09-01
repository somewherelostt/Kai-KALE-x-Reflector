import {
  Horizon,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  TimeoutInfinite,
  Address,
  Transaction,
  Operation,
  Asset,
  Keypair,
  Memo,
  Contract,
} from "@stellar/stellar-sdk";
import * as FreighterApi from "@stellar/freighter-api";

// Stellar testnet configuration
export const server = new Horizon.Server("https://horizon-testnet.stellar.org");
export const networkPassphrase = Networks.TESTNET;

// Contract addresses (these should be set from environment variables)
export const CONTRACT_ADDRESSES = {
  KAIZEN_EVENT: process.env.NEXT_PUBLIC_KAIZEN_EVENT_CONTRACT || "",
  KALE_TOKEN:
    process.env.NEXT_PUBLIC_KALE_TOKEN_CONTRACT ||
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCX4J5",
  KALE_STAKING: process.env.NEXT_PUBLIC_KALE_STAKING_CONTRACT || "",
};

// KALE Token Configuration
export const KALE_CONFIG = {
  TOKEN_ADDRESS: CONTRACT_ADDRESSES.KALE_TOKEN,
  DECIMALS: 7,
  SYMBOL: "KALE",
  STAKE_MULTIPLIER: 1.2, // 20% bonus for staking
  MIN_ORGANIZER_STAKE: 1000, // Minimum KALE stake for organizers
  MIN_ATTENDEE_STAKE: 10, // Minimum KALE stake for attendees
};

// Reflector Oracle Configuration
export const REFLECTOR_CONFIG = {
  API_BASE_URL: "https://api.reflector.network",
  SUPPORTED_ASSETS: ["XLM", "BTC", "ETH", "USDC"],
  SUPPORTED_CURRENCIES: ["USD", "EUR", "GBP", "JPY"],
  UPDATE_INTERVAL: 30000, // 30 seconds
};

// Helper function to build contract invocation transaction
async function buildContractTransaction(
  contractAddress: string,
  method: string,
  args: any[],
  source: string
): Promise<Transaction> {
  const account = await server.loadAccount(source);

  const contract = new Contract(contractAddress);
  const operation = contract.call(method, ...args);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(TimeoutInfinite)
    .build();

  return transaction;
}

/**
 * Initialize a new event contract
 */
export async function initializeEventContract(
  organizerAddress: string,
  eventName: string,
  tokenAddress?: string
) {
  try {
    if (!CONTRACT_ADDRESSES.KAIZEN_EVENT) {
      throw new Error("Contract address not configured");
    }

    const args = [
      new Address(organizerAddress),
      eventName,
      tokenAddress ? new Address(tokenAddress) : null,
    ];

    const transaction = await buildContractTransaction(
      CONTRACT_ADDRESSES.KAIZEN_EVENT,
      "init",
      args,
      organizerAddress
    );

    // Sign with Freighter
    const { signedTxXdr } = await FreighterApi.signTransaction(
      transaction.toXDR(),
      { networkPassphrase, address: organizerAddress }
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
      throw new Error("Transaction failed");
    }
  } catch (error) {
    console.error("Init event contract error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Join an event with payment (main user action) - Fixed to handle event pricing
 */
export async function joinEvent(
  attendeeAddress: string,
  eventId: number = 1,
  eventPrice?: string,
  organizerAddress?: string,
  eventTitle?: string
) {
  try {
    // Create a short memo (max 28 bytes for Stellar) - format: "JOIN_E1_123456"
    const timestamp = Date.now().toString().slice(-6);
    const eventJoinMemo = `JOIN_E${eventId}_${timestamp}`;

    // Determine payment details
    let recipientAddress = attendeeAddress; // Default: send to self (free events)
    let paymentAmount = "0.0000001"; // Minimal amount for free events

    // If event has a price, send payment to organizer
    if (eventPrice && eventPrice !== "Free" && organizerAddress) {
      recipientAddress = organizerAddress;
      paymentAmount = eventPrice.replace(" XLM", "");
    }

    // Create the transaction
    const result = await sendPayment(
      recipientAddress,
      paymentAmount,
      eventJoinMemo
    );

    if (result.success) {
      return {
        success: true,
        transactionHash: result.transactionHash,
        ledger: 0,
      };
    } else {
      throw new Error(result.error || "Transaction failed");
    }
  } catch (error) {
    console.error("Join event error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if user has joined the event
 */
export async function hasJoinedEvent(
  userAddress: string,
  eventId: number = 1
): Promise<boolean> {
  try {
    if (!CONTRACT_ADDRESSES.KAIZEN_EVENT) {
      return false;
    }

    const args = [new Address(userAddress), eventId];

    const transaction = await buildContractTransaction(
      CONTRACT_ADDRESSES.KAIZEN_EVENT,
      "has_ticket",
      args,
      userAddress
    );

    // This would need to be a read-only call in a real implementation
    // For now, return false as we can't easily make read calls without simulation
    return false;
  } catch (error) {
    console.error("Check joined status error:", error);
    return false;
  }
}

/**
 * Get event info from contract
 */
export async function getEventInfo() {
  try {
    if (!CONTRACT_ADDRESSES.KAIZEN_EVENT) {
      return null;
    }

    // This would need proper contract read implementation
    // For now, return mock data
    return {
      name: "Mock Event",
      organizer: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      tokenAddress: null,
      joinCount: 0,
    };
  } catch (error) {
    console.error("Get event info error:", error);
    return null;
  }
}

// Basic Stellar Functions for now - Smart contract integration to be added later

/**
 * Send XLM payment (for ticket purchases)
 */
export async function sendPayment(
  recipientAddress: string,
  amount: string,
  memo?: string
) {
  try {
    const { address } = await FreighterApi.requestAccess();
    const account = await server.loadAccount(address);

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: recipientAddress,
          asset: Asset.native(),
          amount: amount,
        })
      )
      .setTimeout(TimeoutInfinite);

    if (memo) {
      // Ensure memo is within Stellar's 28-byte limit
      const truncatedMemo = memo.length > 28 ? memo.substring(0, 28) : memo;
      transaction.addMemo(Memo.text(truncatedMemo));
    }

    const builtTransaction = transaction.build();

    // Sign transaction with Freighter
    const { signedTxXdr } = await FreighterApi.signTransaction(
      builtTransaction.toXDR(),
      {
        networkPassphrase,
        address: address,
      }
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
      throw new Error("Transaction failed");
    }
  } catch (error) {
    console.error("Send payment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get account balance
 */
export async function getAccountBalance(publicKey: string) {
  try {
    const account = await server.loadAccount(publicKey);
    const balance = account.balances.find(
      (b: any) => b.asset_type === "native"
    );
    return {
      success: true,
      balance: balance ? parseFloat(balance.balance) : 0,
    };
  } catch (error) {
    console.error("Get balance error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      balance: 0,
    };
  }
}

/**
 * Create test account (for development)
 */
export async function createTestAccount() {
  try {
    const keypair = Keypair.random();

    // Fund account using Friendbot
    await fetch(`https://friendbot.stellar.org?addr=${keypair.publicKey()}`);

    return {
      success: true,
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  } catch (error) {
    console.error("Create test account error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Placeholder functions for smart contract integration
// These will be implemented once contracts are deployed

/**
 * Create a new event on the blockchain (placeholder)
 */
export async function createEventOnChain(
  organizerAddress: string,
  title: string,
  description: string,
  date: number,
  location: string,
  price: number,
  maxAttendees: number,
  tokenRewardAmount: number
) {
  console.log("Creating event on chain:", { title, organizerAddress });

  // For now, return mock success
  return {
    success: true,
    transactionHash: "mock_hash_" + Date.now(),
    eventId: Math.floor(Math.random() * 1000) + 1,
  };
}

/**
 * Purchase a ticket for an event (placeholder)
 */
export async function purchaseTicketOnChain(
  eventId: number,
  attendeeAddress: string
) {
  console.log("Purchasing ticket on chain:", { eventId, attendeeAddress });

  // For now, just send a payment and return mock data
  try {
    // This could be enhanced to send payment to event organizer
    return {
      success: true,
      transactionHash: "mock_ticket_hash_" + Date.now(),
      ticketId: eventId * 1000 + Math.floor(Math.random() * 1000),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mint NFT for event attendee (placeholder)
 */
export async function mintEventNFT(
  recipientAddress: string,
  eventId: number,
  name: string,
  description: string,
  imageUrl: string
) {
  console.log("Minting NFT:", { recipientAddress, eventId, name });

  return {
    success: true,
    transactionHash: "mock_nft_hash_" + Date.now(),
    tokenId: Math.floor(Math.random() * 10000) + 1,
  };
}

/**
 * Claim event reward tokens (placeholder)
 */
export async function claimEventReward(userAddress: string, eventId: number) {
  console.log("Claiming reward:", { userAddress, eventId });

  return {
    success: true,
    transactionHash: "mock_reward_hash_" + Date.now(),
    rewardAmount: 100 * 10000000, // 100 tokens in stroops
  };
}

/**
 * Get event details from smart contract (placeholder)
 */
export async function getEventDetails(eventId: number) {
  console.log("Getting event details for:", eventId);
  return {
    success: true,
    event: {
      id: eventId,
      title: "Mock Event",
      description: "Mock Description",
      // ... other event data
    },
  };
}

/**
 * Get user's NFTs (placeholder)
 */
export async function getUserNFTs(userAddress: string) {
  console.log("Getting NFTs for user:", userAddress);
  return {
    success: true,
    nfts: [],
  };
}

/**
 * Get user's token balance (placeholder)
 */
export async function getUserTokenBalance(userAddress: string) {
  console.log("Getting token balance for user:", userAddress);
  return {
    success: true,
    balance: 0,
  };
}

/**
 * Utility function to format Stellar amounts
 */
export function formatStellarAmount(amount: number): string {
  return amount.toFixed(7);
}

/**
 * Utility function to parse Stellar amounts
 */
export function parseStellarAmount(amount: string): number {
  return parseFloat(amount);
}

/**
 * Validate Stellar address
 */
export function isValidStellarAddress(address: string): boolean {
  try {
    new Address(address);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// KALE TOKEN INTEGRATION - Event Staking & Rewards
// =============================================================================

/**
 * Get KALE token balance for a user
 */
export async function getKaleBalance(userAddress: string) {
  try {
    const account = await server.loadAccount(userAddress);
    const kaleBalance = account.balances.find((balance: any) => {
      return (
        balance.asset_code === "KALE" &&
        balance.asset_issuer === CONTRACT_ADDRESSES.KALE_TOKEN
      );
    });

    return {
      success: true,
      balance: kaleBalance ? parseFloat(kaleBalance.balance) : 0,
      formattedBalance: kaleBalance
        ? parseFloat(kaleBalance.balance).toFixed(2)
        : "0.00",
    };
  } catch (error) {
    console.error("Get KALE balance error:", error);
    return {
      success: false,
      balance: 0,
      formattedBalance: "0.00",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Stake KALE tokens for event creation (organizers)
 */
export async function stakeKaleForEvent(
  organizerAddress: string,
  eventId: number,
  stakeAmount: number
) {
  try {
    if (stakeAmount < KALE_CONFIG.MIN_ORGANIZER_STAKE) {
      throw new Error(
        `Minimum organizer stake is ${KALE_CONFIG.MIN_ORGANIZER_STAKE} KALE`
      );
    }

    // Create payment transaction to staking contract
    const account = await server.loadAccount(organizerAddress);
    const kaleAsset = new Asset("KALE", CONTRACT_ADDRESSES.KALE_TOKEN);

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: CONTRACT_ADDRESSES.KALE_STAKING,
          asset: kaleAsset,
          amount: stakeAmount.toString(),
        })
      )
      .addMemo(Memo.text(`STAKE_E${eventId}_ORG`))
      .setTimeout(TimeoutInfinite)
      .build();

    // Sign with Freighter
    const { signedTxXdr } = await FreighterApi.signTransaction(
      transaction.toXDR(),
      { networkPassphrase, address: organizerAddress }
    );

    // Submit transaction
    const signedTransaction = new Transaction(signedTxXdr, networkPassphrase);
    const result = await server.submitTransaction(signedTransaction);

    if (result.successful) {
      return {
        success: true,
        transactionHash: result.hash,
        stakedAmount: stakeAmount,
        eventId: eventId,
      };
    } else {
      throw new Error("Staking transaction failed");
    }
  } catch (error) {
    console.error("Stake KALE error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Stake KALE tokens for event attendance (attendees)
 */
export async function stakeKaleForAttendance(
  attendeeAddress: string,
  eventId: number,
  stakeAmount: number = KALE_CONFIG.MIN_ATTENDEE_STAKE
) {
  try {
    if (stakeAmount < KALE_CONFIG.MIN_ATTENDEE_STAKE) {
      throw new Error(
        `Minimum attendee stake is ${KALE_CONFIG.MIN_ATTENDEE_STAKE} KALE`
      );
    }

    const account = await server.loadAccount(attendeeAddress);
    const kaleAsset = new Asset("KALE", CONTRACT_ADDRESSES.KALE_TOKEN);

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: CONTRACT_ADDRESSES.KALE_STAKING,
          asset: kaleAsset,
          amount: stakeAmount.toString(),
        })
      )
      .addMemo(Memo.text(`STAKE_E${eventId}_ATT`))
      .setTimeout(TimeoutInfinite)
      .build();

    // Sign with Freighter
    const { signedTxXdr } = await FreighterApi.signTransaction(
      transaction.toXDR(),
      { networkPassphrase, address: attendeeAddress }
    );

    // Submit transaction
    const signedTransaction = new Transaction(signedTxXdr, networkPassphrase);
    const result = await server.submitTransaction(signedTransaction);

    if (result.successful) {
      return {
        success: true,
        transactionHash: result.hash,
        stakedAmount: stakeAmount,
        eventId: eventId,
      };
    } else {
      throw new Error("Attendance staking transaction failed");
    }
  } catch (error) {
    console.error("Stake KALE for attendance error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Claim KALE rewards after event attendance
 */
export async function claimKaleRewards(
  userAddress: string,
  eventId: number,
  attended: boolean = true
) {
  try {
    // In a real implementation, this would verify attendance and distribute rewards
    // For now, we'll simulate the reward calculation

    const baseStake = KALE_CONFIG.MIN_ATTENDEE_STAKE;
    let rewardAmount = 0;

    if (attended) {
      // Attended users get their stake back + bonus
      rewardAmount = baseStake * KALE_CONFIG.STAKE_MULTIPLIER;
    }
    // No-show users lose their stake (rewardAmount = 0)

    // This would be handled by the smart contract in production
    console.log(`Claiming KALE rewards for event ${eventId}:`, {
      userAddress,
      attended,
      rewardAmount,
    });

    return {
      success: true,
      transactionHash: "mock_kale_reward_" + Date.now(),
      rewardAmount: rewardAmount,
      attended: attended,
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
 * Get KALE staking status for an event
 */
export async function getEventStakingStatus(eventId: number) {
  try {
    // In production, this would query the staking contract
    // For now, return mock data
    return {
      success: true,
      eventId: eventId,
      organizerStake: KALE_CONFIG.MIN_ORGANIZER_STAKE,
      totalAttendeeStakes: KALE_CONFIG.MIN_ATTENDEE_STAKE * 10, // Mock 10 attendees
      rewardPool: KALE_CONFIG.MIN_ORGANIZER_STAKE * 0.1, // 10% of organizer stake as reward pool
      stakingEnabled: true,
    };
  } catch (error) {
    console.error("Get staking status error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// REFLECTOR ORACLE INTEGRATION - Dynamic Pricing
// =============================================================================

/**
 * Get real-time price data from Reflector Oracle
 */
export async function getReflectorPriceData(
  asset: string = "XLM",
  currency: string = "USD"
) {
  try {
    // In production, this would call Reflector's actual API
    // For now, we'll simulate price data with realistic fluctuations
    const mockPrices: { [key: string]: { [key: string]: number } } = {
      XLM: { USD: 0.12, EUR: 0.11, GBP: 0.095, JPY: 18.5 },
      BTC: { USD: 43000, EUR: 39500, GBP: 34000, JPY: 6200000 },
      ETH: { USD: 2400, EUR: 2200, GBP: 1900, JPY: 350000 },
      USDC: { USD: 1.0, EUR: 0.92, GBP: 0.79, JPY: 145 },
    };

    // Add some realistic price volatility
    const basePrice = mockPrices[asset]?.[currency] || 0.12;
    const volatility = 0.02; // 2% volatility
    const randomFactor = 1 + (Math.random() - 0.5) * 2 * volatility;
    const currentPrice = basePrice * randomFactor;

    return {
      success: true,
      asset: asset,
      currency: currency,
      price: currentPrice,
      formattedPrice: currentPrice.toLocaleString("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: asset === "XLM" ? 4 : 2,
        maximumFractionDigits: asset === "XLM" ? 4 : 2,
      }),
      timestamp: Date.now(),
      source: "Reflector Oracle",
    };
  } catch (error) {
    console.error("Get Reflector price error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      price: 0,
    };
  }
}

/**
 * Calculate dynamic event pricing based on market conditions
 */
export async function calculateDynamicEventPrice(
  basePrice: number,
  baseCurrency: string = "USD",
  targetAsset: string = "XLM",
  demandMultiplier: number = 1.0
) {
  try {
    const priceData = await getReflectorPriceData(targetAsset, baseCurrency);

    if (!priceData.success) {
      throw new Error("Failed to get price data");
    }

    // Calculate asset amount needed for base price
    let assetAmount = basePrice / priceData.price;

    // Apply demand-based surge pricing
    assetAmount = assetAmount * demandMultiplier;

    // Apply market volatility buffer (5% extra)
    assetAmount = assetAmount * 1.05;

    return {
      success: true,
      basePrice: basePrice,
      baseCurrency: baseCurrency,
      targetAsset: targetAsset,
      assetAmount: parseFloat(assetAmount.toFixed(7)),
      assetPrice: priceData.price,
      demandMultiplier: demandMultiplier,
      formattedAmount: `${assetAmount.toFixed(4)} ${targetAsset}`,
      equivalentFiat: priceData.formattedPrice,
      timestamp: priceData.timestamp,
    };
  } catch (error) {
    console.error("Calculate dynamic pricing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get multi-currency price display for events
 */
export async function getMultiCurrencyPricing(xlmAmount: number) {
  try {
    const currencies = REFLECTOR_CONFIG.SUPPORTED_CURRENCIES;
    const pricing: { [key: string]: any } = {};

    for (const currency of currencies) {
      const priceData = await getReflectorPriceData("XLM", currency);
      if (priceData.success) {
        const fiatValue = xlmAmount * priceData.price;
        pricing[currency] = {
          amount: fiatValue,
          formatted: fiatValue.toLocaleString("en-US", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
          rate: priceData.price,
        };
      }
    }

    return {
      success: true,
      xlmAmount: xlmAmount,
      currencies: pricing,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Get multi-currency pricing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Monitor price changes and trigger automatic adjustments
 */
export async function monitorPriceChanges(
  eventId: number,
  thresholdPercent: number = 5.0
) {
  try {
    // This would be implemented as a background service in production
    // For now, just return monitoring status

    return {
      success: true,
      eventId: eventId,
      monitoring: true,
      thresholdPercent: thresholdPercent,
      lastUpdate: Date.now(),
      priceAdjustments: 0,
    };
  } catch (error) {
    console.error("Price monitoring error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
