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
import { TrendingUp, Coins, Users, Award, DollarSign } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import KaleStaking from "./kale-staking";
import DynamicPricing from "./dynamic-pricing";
import { kaleIntegration } from "@/lib/kale";
import { reflectorAPI } from "@/lib/reflector";

interface HackathonFeaturesProps {
  eventId: number;
  eventData: {
    title: string;
    date: string;
    price: number;
    organizer: string;
    enableKaleStaking?: boolean;
    enableDynamicPricing?: boolean;
    demandMultiplier?: number;
  };
  isOrganizer?: boolean;
  onJoinEvent?: (transactionHash: string) => void;
}

export default function HackathonFeatures({
  eventId,
  eventData,
  isOrganizer = false,
  onJoinEvent,
}: HackathonFeaturesProps) {
  const { address, isConnected } = useWallet();
  const [activeTab, setActiveTab] = useState("overview");
  const [kaleProfile, setKaleProfile] = useState<any>(null);
  const [priceData, setPriceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [address, eventId]);

  const loadData = async () => {
    if (address) {
      try {
        // Load KALE profile
        const profile = await kaleIntegration.getUserKaleProfile(address);
        setKaleProfile(profile);

        // Load price data
        const prices = await reflectorAPI.getPrice("XLM", "USD");
        setPriceData(prices);
      } catch (error) {
        console.error("Failed to load hackathon data:", error);
      }
    }
  };

  const handleStakeSuccess = (transactionHash: string) => {
    console.log("Staking successful:", transactionHash);
    loadData(); // Refresh data
  };

  const handleJoinWithKale = async () => {
    if (!address) return;

    setLoading(true);
    try {
      // First stake KALE tokens for attendance
      const stakeResult = await kaleIntegration.stakeForEvent(
        address,
        eventId,
        10,
        "attendee"
      );

      if (stakeResult.success) {
        // Then join the event
        if (onJoinEvent && stakeResult.transactionHash) {
          onJoinEvent(stakeResult.transactionHash);
        }
      }
    } catch (error) {
      console.error("Failed to join with KALE:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!eventData.enableKaleStaking && !eventData.enableDynamicPricing) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            This event doesn't have KALE staking or dynamic pricing enabled.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hackathon Features Header */}
      <Card className="border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-orange-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Hackathon Features
            <Badge variant="secondary">KALE × Reflector</Badge>
          </CardTitle>
          <CardDescription>
            This event integrates with KALE's proof-of-teamwork staking and
            Reflector's dynamic pricing oracle
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Feature Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {eventData.enableKaleStaking && (
            <TabsTrigger value="staking">KALE Staking</TabsTrigger>
          )}
          {eventData.enableDynamicPricing && (
            <TabsTrigger value="pricing">Dynamic Pricing</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* KALE Staking Overview */}
            {eventData.enableKaleStaking && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Coins className="h-5 w-5 text-green-500" />
                    KALE Staking
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Your KALE Balance:</span>
                    <span className="font-medium text-green-600">
                      {kaleProfile?.formattedBalance || "0.00"} KALE
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Minimum Stake:</span>
                    <span>{isOrganizer ? "1,000" : "10"} KALE</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Reward Multiplier:</span>
                    <span className="text-yellow-600">1.2x</span>
                  </div>

                  {isConnected ? (
                    <Button
                      onClick={() => setActiveTab("staking")}
                      className="w-full mt-3"
                      variant={kaleProfile?.canStake ? "default" : "secondary"}
                    >
                      {isOrganizer ? "Stake as Organizer" : "Stake to Join"}
                    </Button>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Connect your wallet to participate in KALE staking
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Dynamic Pricing Overview */}
            {eventData.enableDynamicPricing && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                    Dynamic Pricing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Base Price:</span>
                    <span className="font-medium">${eventData.price}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Current XLM Rate:</span>
                    <span>${priceData?.price?.toFixed(4) || "0.12"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Demand Level:</span>
                    <Badge
                      variant={
                        (eventData.demandMultiplier || 1) > 1.5
                          ? "destructive"
                          : (eventData.demandMultiplier || 1) > 1.2
                          ? "secondary"
                          : "default"
                      }
                    >
                      {(eventData.demandMultiplier || 1) > 1.5
                        ? "High"
                        : (eventData.demandMultiplier || 1) > 1.2
                        ? "Medium"
                        : "Normal"}
                    </Badge>
                  </div>

                  <Button
                    onClick={() => setActiveTab("pricing")}
                    className="w-full mt-3"
                    variant="outline"
                  >
                    View Live Pricing
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Actions */}
          {isConnected && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {eventData.enableKaleStaking && (
                    <Button
                      onClick={handleJoinWithKale}
                      disabled={loading || !kaleProfile?.canStake}
                      className="flex items-center gap-2"
                    >
                      <Coins className="h-4 w-4" />
                      {loading ? "Processing..." : "Join with KALE Stake"}
                    </Button>
                  )}

                  <Button variant="outline" asChild>
                    <a
                      href="https://testnet.kalefarm.xyz/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Mine More KALE
                    </a>
                  </Button>
                </div>

                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    This event uses innovative Web3 mechanics. KALE staking
                    proves commitment, and dynamic pricing ensures fair market
                    value through Reflector oracles.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Project Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About These Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-green-600 mb-2">
                    🌾 KALE Integration
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Proof-of-teamwork token staking</li>
                    <li>• Organizer commitment verification</li>
                    <li>• Anti-spam attendance mechanism</li>
                    <li>• Reward distribution for actual attendees</li>
                  </ul>
                  <Button variant="link" size="sm" asChild className="pl-0">
                    <a
                      href="https://kaleonstellar.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Learn more about KALE →
                    </a>
                  </Button>
                </div>

                <div>
                  <h4 className="font-medium text-blue-600 mb-2">
                    📊 Reflector Oracle
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Real-time price feeds</li>
                    <li>• Multi-currency support</li>
                    <li>• Market-driven surge pricing</li>
                    <li>• Global payment accessibility</li>
                  </ul>
                  <Button variant="link" size="sm" asChild className="pl-0">
                    <a
                      href="https://reflector.network"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Learn more about Reflector →
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {eventData.enableKaleStaking && (
          <TabsContent value="staking">
            <KaleStaking
              eventId={eventId}
              eventTitle={eventData.title}
              eventDate={eventData.date}
              isOrganizer={isOrganizer}
              onStakeSuccess={handleStakeSuccess}
            />
          </TabsContent>
        )}

        {eventData.enableDynamicPricing && (
          <TabsContent value="pricing">
            <DynamicPricing
              eventId={eventId}
              basePrice={eventData.price}
              demandMultiplier={eventData.demandMultiplier || 1.0}
              onPriceUpdate={(newPrice, currency) => {
                console.log("Event price updated:", newPrice, currency);
              }}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
