"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Globe,
  Clock,
} from "lucide-react";
import { reflectorAPI, formatPrice, formatPriceChange } from "@/lib/reflector";

interface DynamicPricingProps {
  eventId: number;
  basePrice: number;
  baseCurrency?: string;
  demandMultiplier?: number;
  onPriceUpdate?: (newPrice: number, currency: string) => void;
}

interface PriceData {
  asset: string;
  price: number;
  change24h: number;
  timestamp: number;
}

export default function DynamicPricing({
  eventId,
  basePrice,
  baseCurrency = "USD",
  demandMultiplier = 1.0,
  onPriceUpdate,
}: DynamicPricingProps) {
  const [priceData, setPriceData] = useState<{ [key: string]: PriceData }>({});
  const [multiCurrencyPrices, setMultiCurrencyPrices] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const supportedAssets = ["XLM", "BTC", "ETH", "USDC"];
  const supportedCurrencies = ["USD", "EUR", "GBP", "JPY"];

  useEffect(() => {
    loadPriceData();

    if (autoRefresh) {
      const interval = setInterval(loadPriceData, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadPriceData = async () => {
    try {
      setLoading(true);

      // Get price data for all supported assets
      const pricePromises = supportedAssets.map(async (assetSymbol) => {
        const data = await reflectorAPI.getPrice(assetSymbol, baseCurrency);
        return {
          asset: assetSymbol,
          price: data.price,
          timestamp: data.timestamp,
        };
      });

      const prices = await Promise.all(pricePromises);
      const priceMap: { [key: string]: PriceData } = {};

      prices.forEach((price) => {
        if (price.asset) {
          priceMap[price.asset] = {
            asset: price.asset,
            price: price.price,
            change24h: (Math.random() - 0.5) * 10, // Mock 24h change
            timestamp: price.timestamp,
          };
        }
      });

      setPriceData(priceMap);

      // Calculate multi-currency pricing for XLM
      if (priceMap.XLM) {
        const xlmPrice = priceMap.XLM.price;
        const xlmAmount = (basePrice * demandMultiplier) / xlmPrice;

        const currencyPrices: { [key: string]: any } = {};
        for (const currency of supportedCurrencies) {
          const fxData = await reflectorAPI.getPrice("XLM", currency);
          if (fxData) {
            const fiatValue = xlmAmount * fxData.price;
            currencyPrices[currency] = {
              xlmAmount: xlmAmount,
              fiatValue: fiatValue,
              formatted: formatPrice(fiatValue, currency),
              rate: fxData.price,
            };
          }
        }

        setMultiCurrencyPrices(currencyPrices);

        // Notify parent component of price update
        if (onPriceUpdate) {
          onPriceUpdate(xlmAmount, "XLM");
        }
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to load price data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDynamicPrice = (
    asset: string
  ): { amount: number; fiatValue: number } => {
    const priceInfo = priceData[asset];
    if (!priceInfo) return { amount: 0, fiatValue: 0 };

    const adjustedPrice = basePrice * demandMultiplier * 1.05; // 5% buffer
    const assetAmount = adjustedPrice / priceInfo.price;

    return {
      amount: assetAmount,
      fiatValue: adjustedPrice,
    };
  };

  const getDemandLevel = (
    multiplier: number
  ): { level: string; color: string; description: string } => {
    if (multiplier >= 2.0) {
      return {
        level: "Very High",
        color: "destructive",
        description: "Peak demand - prices significantly increased",
      };
    } else if (multiplier >= 1.5) {
      return {
        level: "High",
        color: "secondary",
        description: "High demand - surge pricing active",
      };
    } else if (multiplier >= 1.2) {
      return {
        level: "Moderate",
        color: "default",
        description: "Moderate demand - slight price increase",
      };
    } else {
      return { level: "Low", color: "default", description: "Normal pricing" };
    }
  };

  const demand = getDemandLevel(demandMultiplier);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-500" />
            Dynamic Event Pricing
            <Badge variant={demand.color as any}>{demand.level} Demand</Badge>
          </CardTitle>
          <CardDescription>
            Real-time pricing powered by Reflector Oracle • Last updated:{" "}
            {lastUpdate.toLocaleTimeString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="xlm" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              {supportedAssets.map((asset) => (
                <TabsTrigger key={asset} value={asset.toLowerCase()}>
                  {asset}
                </TabsTrigger>
              ))}
            </TabsList>

            {supportedAssets.map((asset) => {
              const pricing = calculateDynamicPrice(asset);
              const priceInfo = priceData[asset];
              const change = priceInfo?.change24h || 0;
              const changeInfo = formatPriceChange(change);

              return (
                <TabsContent
                  key={asset}
                  value={asset.toLowerCase()}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Current Price
                            </span>
                            <div className="flex items-center gap-1">
                              {changeInfo.isPositive ? (
                                <TrendingUp className="h-3 w-3 text-green-500" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                              )}
                              <span
                                className={`text-xs ${
                                  changeInfo.isPositive
                                    ? "text-green-500"
                                    : "text-red-500"
                                }`}
                              >
                                {changeInfo.formatted}
                              </span>
                            </div>
                          </div>
                          <p className="text-xl font-bold">
                            {formatPrice(priceInfo?.price || 0, baseCurrency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            per {asset}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <span className="text-sm font-medium">
                            Event Price
                          </span>
                          <p className="text-xl font-bold text-blue-600">
                            {pricing.amount.toFixed(asset === "XLM" ? 4 : 6)}{" "}
                            {asset}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ≈ {formatPrice(pricing.fiatValue, baseCurrency)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {asset === "XLM" &&
                    Object.keys(multiCurrencyPrices).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Multi-Currency Pricing
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {supportedCurrencies.map((currency) => {
                            const currencyData = multiCurrencyPrices[currency];
                            if (!currencyData) return null;

                            return (
                              <div
                                key={currency}
                                className="p-3 bg-muted/50 rounded-lg"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium">
                                    {currency}
                                  </span>
                                  <span className="text-sm">
                                    {currencyData.formatted}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {currencyData.xlmAmount.toFixed(4)} XLM
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </TabsContent>
              );
            })}
          </Tabs>

          <div className="flex justify-between items-center pt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPriceData}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <Clock className="h-4 w-4 mr-1" />
                Auto Refresh
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Powered by Reflector Oracle
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demand Information */}
      <Alert>
        <TrendingUp className="h-4 w-4" />
        <AlertDescription>
          <strong>Demand Level: {demand.level}</strong> - {demand.description}
          {demandMultiplier > 1 && (
            <span className="block mt-1 text-sm">
              Base price (${basePrice}) × {demandMultiplier.toFixed(1)} demand
              multiplier
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Market Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Market Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Prices update every 30 seconds via Reflector Network</p>
            <p>• 5% volatility buffer applied to all calculations</p>
            <p>• Surge pricing active during high demand periods</p>
            <p>• Multi-currency support for global accessibility</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://reflector.network"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn About Reflector
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://reflector.network/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                API Documentation
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
