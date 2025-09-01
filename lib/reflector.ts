// Reflector Oracle API Integration
// https://reflector.network/docs

export interface ReflectorPriceData {
  asset: string;
  price: number;
  timestamp: number;
  source: string;
}

export interface ReflectorAssetPrice {
  asset: string;
  prices: {
    [currency: string]: {
      price: number;
      change24h: number;
      timestamp: number;
    };
  };
}

/**
 * Reflector Oracle API Client
 */
export class ReflectorAPI {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  constructor(baseUrl: string = "https://api.reflector.network") {
    this.baseUrl = baseUrl;
  }

  /**
   * Get cached data or fetch new data
   */
  private async getCachedOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }

    try {
      const data = await fetchFn();
      this.cache.set(key, { data, timestamp: now });
      return data;
    } catch (error) {
      // Return cached data if available, even if stale
      if (cached) {
        console.warn("Using stale cache data due to fetch error:", error);
        return cached.data as T;
      }
      throw error;
    }
  }

  /**
   * Get price feeds for specific assets
   */
  async getAssetPrices(
    assets: string[] = ["XLM"]
  ): Promise<ReflectorAssetPrice[]> {
    const cacheKey = `prices_${assets.join(",")}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      // Mock implementation - replace with actual Reflector API calls
      return assets.map((asset) => ({
        asset,
        prices: {
          USD: {
            price: this.getMockPrice(asset, "USD"),
            change24h: (Math.random() - 0.5) * 10, // -5% to +5% change
            timestamp: Date.now(),
          },
          EUR: {
            price: this.getMockPrice(asset, "EUR"),
            change24h: (Math.random() - 0.5) * 10,
            timestamp: Date.now(),
          },
          GBP: {
            price: this.getMockPrice(asset, "GBP"),
            change24h: (Math.random() - 0.5) * 10,
            timestamp: Date.now(),
          },
        },
      }));
    });
  }

  /**
   * Get FX rates
   */
  async getFXRates(
    baseCurrency: string = "USD"
  ): Promise<{ [key: string]: number }> {
    const cacheKey = `fx_${baseCurrency}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      // Mock FX rates - replace with actual Reflector API
      const rates: { [key: string]: number } = {
        USD: 1.0,
        EUR: 0.92,
        GBP: 0.79,
        JPY: 145.0,
        CAD: 1.35,
        AUD: 1.55,
        CHF: 0.88,
      };

      // Add some realistic fluctuation
      Object.keys(rates).forEach((currency) => {
        if (currency !== baseCurrency) {
          rates[currency] *= 1 + (Math.random() - 0.5) * 0.02; // 1% fluctuation
        }
      });

      return rates;
    });
  }

  /**
   * Get price for specific asset/currency pair
   */
  async getPrice(
    asset: string,
    currency: string = "USD"
  ): Promise<ReflectorPriceData> {
    const cacheKey = `price_${asset}_${currency}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const price = this.getMockPrice(asset, currency);

      return {
        asset,
        price,
        timestamp: Date.now(),
        source: "Reflector Oracle",
      };
    });
  }

  /**
   * Mock price generator - replace with actual API calls
   */
  private getMockPrice(asset: string, currency: string): number {
    const basePrices: { [key: string]: { [key: string]: number } } = {
      XLM: { USD: 0.12, EUR: 0.11, GBP: 0.095, JPY: 18.5 },
      BTC: { USD: 43000, EUR: 39500, GBP: 34000, JPY: 6200000 },
      ETH: { USD: 2400, EUR: 2200, GBP: 1900, JPY: 350000 },
      USDC: { USD: 1.0, EUR: 0.92, GBP: 0.79, JPY: 145 },
      KALE: { USD: 0.05, EUR: 0.046, GBP: 0.04, JPY: 7.25 },
    };

    const basePrice = basePrices[asset]?.[currency] || 0.1;

    // Add realistic volatility
    const volatility = asset === "BTC" ? 0.03 : asset === "ETH" ? 0.04 : 0.02;
    const randomFactor = 1 + (Math.random() - 0.5) * 2 * volatility;

    return basePrice * randomFactor;
  }

  /**
   * Subscribe to price updates (WebSocket in production)
   */
  subscribeToUpdates(
    assets: string[],
    callback: (data: ReflectorAssetPrice[]) => void
  ): () => void {
    // Mock subscription - in production, this would use WebSocket
    const interval = setInterval(async () => {
      try {
        // Clear cache to force fresh data
        assets.forEach((asset) => {
          this.cache.delete(`price_${asset}_USD`);
          this.cache.delete(`price_${asset}_EUR`);
          this.cache.delete(`price_${asset}_GBP`);
        });

        const data = await this.getAssetPrices(assets);
        callback(data);
      } catch (error) {
        console.error("Price update error:", error);
      }
    }, 5000); // Update every 5 seconds

    // Return unsubscribe function
    return () => clearInterval(interval);
  }

  /**
   * Get market data for dashboard
   */
  async getMarketData(): Promise<{
    xlmPrice: number;
    xlmChange24h: number;
    btcPrice: number;
    ethPrice: number;
    totalMarketCap: number;
    timestamp: number;
  }> {
    const cacheKey = "market_data";

    return this.getCachedOrFetch(cacheKey, async () => {
      const xlmData = await this.getPrice("XLM", "USD");
      const btcData = await this.getPrice("BTC", "USD");
      const ethData = await this.getPrice("ETH", "USD");

      return {
        xlmPrice: xlmData.price,
        xlmChange24h: (Math.random() - 0.5) * 10, // Mock 24h change
        btcPrice: btcData.price,
        ethPrice: ethData.price,
        totalMarketCap: 1.2e12, // Mock total market cap
        timestamp: Date.now(),
      };
    });
  }
}

// Export singleton instance
export const reflectorAPI = new ReflectorAPI();

// Utility functions
export const formatPrice = (
  price: number,
  currency: string = "USD"
): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "USD" && price < 1 ? 4 : 2,
    maximumFractionDigits: currency === "USD" && price < 1 ? 4 : 2,
  }).format(price);
};

export const formatPriceChange = (
  change: number
): { formatted: string; isPositive: boolean } => {
  const isPositive = change >= 0;
  const formatted = `${isPositive ? "+" : ""}${change.toFixed(2)}%`;
  return { formatted, isPositive };
};

export const calculatePriceInCurrency = (
  xlmAmount: number,
  xlmPrice: number,
  currency: string = "USD"
): string => {
  const value = xlmAmount * xlmPrice;
  return formatPrice(value, currency);
};
