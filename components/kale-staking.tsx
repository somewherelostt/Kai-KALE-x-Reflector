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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, TrendingUp, Users, Clock, Award } from "lucide-react";
import { kaleIntegration, formatKaleAmount, getStakingRisk } from "@/lib/kale";
import { useWallet } from "@/contexts/WalletContext";

interface KaleStakingProps {
  eventId: number;
  eventTitle: string;
  eventDate: string;
  isOrganizer?: boolean;
  onStakeSuccess?: (transactionHash: string) => void;
}

export default function KaleStaking({
  eventId,
  eventTitle,
  eventDate,
  isOrganizer = false,
  onStakeSuccess,
}: KaleStakingProps) {
  const { address } = useWallet();
  const [stakeAmount, setStakeAmount] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [stakingStats, setStakingStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const minStake = isOrganizer ? 1000 : 10;
  const stakeType = isOrganizer ? "organizer" : "attendee";

  useEffect(() => {
    loadUserProfile();
    loadStakingStats();
  }, [address, eventId]);

  const loadUserProfile = async () => {
    if (!address) return;

    try {
      const profile = await kaleIntegration.getUserKaleProfile(address);
      setUserProfile(profile);
    } catch (error) {
      console.error("Failed to load user profile:", error);
    }
  };

  const loadStakingStats = async () => {
    try {
      const stats = await kaleIntegration.getEventStakingStats(eventId);
      setStakingStats(stats);
    } catch (error) {
      console.error("Failed to load staking stats:", error);
    }
  };

  const handleStake = async () => {
    if (!address || !stakeAmount) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const amount = parseFloat(stakeAmount);
      const result = await kaleIntegration.stakeForEvent(
        address,
        eventId,
        amount,
        stakeType
      );

      if (result.success) {
        setSuccess(`Successfully staked ${amount} KALE tokens!`);
        setStakeAmount("");
        loadUserProfile();
        loadStakingStats();
        if (onStakeSuccess && result.transactionHash) {
          onStakeSuccess(result.transactionHash);
        }
      } else {
        setError(result.error || "Staking failed");
      }
    } catch (error) {
      setError("Staking transaction failed");
      console.error("Staking error:", error);
    } finally {
      setLoading(false);
    }
  };

  const canStake = userProfile?.canStake && parseFloat(stakeAmount) >= minStake;
  const risk = stakeAmount ? getStakingRisk(parseFloat(stakeAmount)) : "Low";

  if (!address) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">
            Connect your wallet to participate in KALE staking
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            KALE Event Staking
          </CardTitle>
          <CardDescription>
            Stake KALE tokens to show commitment and earn rewards for{" "}
            {eventTitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Balance & Level */}
          {userProfile && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">
                  Your KALE Balance
                </p>
                <p className="text-xl font-bold text-green-600">
                  {formatKaleAmount(userProfile.balance || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Farmer Level</p>
                <Badge variant="secondary">
                  {userProfile.level?.name} (Level {userProfile.level?.level})
                </Badge>
              </div>
            </div>
          )}

          <Tabs defaultValue="stake" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stake">Stake KALE</TabsTrigger>
              <TabsTrigger value="stats">Event Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="stake" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Stake Amount (Min: {minStake} KALE)
                  </label>
                  <Input
                    type="number"
                    placeholder={`Enter amount (≥${minStake})`}
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    min={minStake}
                    max={userProfile?.balance || 0}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>
                      Risk Level:{" "}
                      <Badge
                        variant={
                          risk === "High"
                            ? "destructive"
                            : risk === "Medium"
                            ? "secondary"
                            : "default"
                        }
                      >
                        {risk}
                      </Badge>
                    </span>
                    <span>
                      Available: {formatKaleAmount(userProfile?.balance || 0)}
                    </span>
                  </div>
                </div>

                {/* Staking Info */}
                <Alert>
                  <Award className="h-4 w-4" />
                  <AlertDescription>
                    {isOrganizer ? (
                      <>
                        <strong>Organizer Commitment:</strong> Your stake
                        demonstrates event commitment. 10% goes to attendee
                        reward pool. Get 90% back if event is successful.
                      </>
                    ) : (
                      <>
                        <strong>Attendance Proof:</strong> Show up to the event
                        to get your stake back + bonus rewards. No-shows forfeit
                        their stake to actual attendees.
                      </>
                    )}
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleStake}
                  disabled={!canStake || loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Staking...
                    </>
                  ) : (
                    `Stake ${stakeAmount || minStake} KALE`
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              {stakingStats && (
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Stakers
                          </p>
                          <p className="font-semibold">
                            {stakingStats.attendeeStakes?.length || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total Staked
                          </p>
                          <p className="font-semibold">
                            {formatKaleAmount(stakingStats.totalStaked || 0)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Reward Pool
                          </p>
                          <p className="font-semibold">
                            {formatKaleAmount(stakingStats.rewardPool || 0)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Status
                          </p>
                          <Badge>{stakingStats.eventStatus}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Participation Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Expected Attendance</span>
                  <span>
                    {stakingStats?.actualAttendees || 0}/
                    {stakingStats?.expectedAttendees || 0}
                  </span>
                </div>
                <Progress
                  value={
                    ((stakingStats?.actualAttendees || 0) /
                      (stakingStats?.expectedAttendees || 1)) *
                    100
                  }
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription className="text-green-600">
                {success}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* KALE Farming Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Want More KALE?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Mine KALE tokens through proof-of-teamwork farming
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://testnet.kalefarm.xyz/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Web Mining
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://kaleonstellar.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn More
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
