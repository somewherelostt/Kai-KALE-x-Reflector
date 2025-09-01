"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { CalendarIcon, TrendingUp, Coins } from "lucide-react";
import KaleStaking from "@/components/kale-staking";
import DynamicPricing from "@/components/dynamic-pricing";
import { useWallet } from "@/contexts/WalletContext";

export default function CreateEventPage() {
  const router = useRouter();
  const { address } = useWallet();
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    price: "",
    seats: "",
    category: "Live shows",
    enableKaleStaking: true,
    enableDynamicPricing: true,
    demandMultiplier: 1.0,
  });
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  type User = { _id: string; [key: string]: any };
  const [user, setUser] = useState<User | null>(null);

  const fetchUser = async () => {
    const res = await fetch(
      "https://kaizenx-production.up.railway.app/api/users/me",
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      setUser(data);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Combine date and time into a single Date object
      const eventDateTime = new Date(`${form.date}T${form.time}`);

      if (eventDateTime <= new Date()) {
        throw new Error("Event date must be in the future");
      }

      await fetchUser();
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("date", eventDateTime.toISOString());
      formData.append("location", form.location);
      formData.append("price", form.price);
      formData.append("seats", form.seats);
      formData.append("category", form.category);
      formData.append("user", user?._id || "");
      formData.append("enableKaleStaking", form.enableKaleStaking.toString());
      formData.append(
        "enableDynamicPricing",
        form.enableDynamicPricing.toString()
      );
      formData.append("demandMultiplier", form.demandMultiplier.toString());

      if (image) formData.append("image", image);

      const res = await fetch(
        "https://kaizenx-production.up.railway.app/api/events",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create event");
      }

      const eventData = await res.json();

      // If KALE staking is enabled and user has wallet connected, redirect to staking
      if (form.enableKaleStaking && address) {
        router.push(`/event/${eventData._id}?tab=staking`);
      } else {
        router.push("/calendar");
      }
    } catch (err: any) {
      setError(err.message || "Error creating event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kaizen-black text-kaizen-white">
      <div className="max-w-md mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between py-4 pt-safe">
          <Button
            variant="ghost"
            onClick={() =>
              currentStep > 1 ? setCurrentStep(currentStep - 1) : router.back()
            }
            className="text-kaizen-white hover:bg-kaizen-dark-gray p-2"
            size="sm"
          >
            ← Back
          </Button>
          <h1 className="text-lg font-bold">Create Event ({currentStep}/3)</h1>
          <div className="w-14"></div>
        </div>

        {/* Progress Steps */}
        <div className="flex mb-6">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex-1 flex items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  step <= currentStep
                    ? "bg-kaizen-yellow text-kaizen-black"
                    : "bg-kaizen-dark-gray text-kaizen-gray"
                }`}
              >
                {step}
              </div>
              {step < 3 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    step < currentStep
                      ? "bg-kaizen-yellow"
                      : "bg-kaizen-dark-gray"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Basic Event Info */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-kaizen-yellow mb-4">
                Basic Event Information
              </h2>

              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="title"
                    className="text-kaizen-white text-sm font-medium mb-2 block"
                  >
                    Event Title *
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Enter event title"
                    value={form.title}
                    onChange={handleChange}
                    required
                    className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white placeholder:text-kaizen-gray h-11"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="description"
                    className="text-kaizen-white text-sm font-medium mb-2 block"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe your event..."
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white placeholder:text-kaizen-gray resize-none"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="category"
                    className="text-kaizen-white text-sm font-medium mb-2 block"
                  >
                    Category *
                  </Label>
                  <select
                    id="category"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                    className="w-full h-11 px-3 bg-kaizen-dark-gray border border-kaizen-gray/30 text-kaizen-white rounded-md focus:outline-none focus:ring-2 focus:ring-kaizen-yellow appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%23c1c1c1%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5em_1.5em] bg-[position:right_0.5rem_center] bg-no-repeat pr-10"
                  >
                    <option value="Live shows">Live shows</option>
                    <option value="Tourism">Tourism</option>
                    <option value="Fever Origin">Fever Origin</option>
                  </select>
                </div>

                <div>
                  <Label
                    htmlFor="location"
                    className="text-kaizen-white text-sm font-medium mb-2 block"
                  >
                    Location *
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    placeholder="Event venue or address"
                    value={form.location}
                    onChange={handleChange}
                    required
                    className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white placeholder:text-kaizen-gray h-11"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Date, Time & Pricing */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-kaizen-yellow mb-4">
                Schedule & Pricing
              </h2>

              {/* Date & Time */}
              <div className="space-y-4">
                <h3 className="text-kaizen-white font-medium flex items-center gap-2 text-sm">
                  <CalendarIcon className="w-4 h-4" />
                  Date & Time
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label
                      htmlFor="date"
                      className="text-kaizen-white text-sm font-medium mb-2 block"
                    >
                      Date *
                    </Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      value={form.date}
                      onChange={handleChange}
                      required
                      min={new Date().toISOString().split("T")[0]}
                      className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white h-11"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="time"
                      className="text-kaizen-white text-sm font-medium mb-2 block"
                    >
                      Time *
                    </Label>
                    <Input
                      id="time"
                      name="time"
                      type="time"
                      value={form.time}
                      onChange={handleChange}
                      required
                      className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label
                      htmlFor="price"
                      className="text-kaizen-white text-sm font-medium mb-2 block"
                    >
                      Base Price (USD) *
                    </Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="25.00"
                      value={form.price}
                      onChange={handleChange}
                      required
                      className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white placeholder:text-kaizen-gray h-11"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="seats"
                      className="text-kaizen-white text-sm font-medium mb-2 block"
                    >
                      Available Seats *
                    </Label>
                    <Input
                      id="seats"
                      name="seats"
                      type="number"
                      min="1"
                      placeholder="250"
                      value={form.seats}
                      onChange={handleChange}
                      required
                      className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white placeholder:text-kaizen-gray h-11"
                    />
                  </div>
                </div>

                {/* Dynamic Pricing Preview */}
                {form.enableDynamicPricing && form.price && (
                  <div className="mt-4">
                    <DynamicPricing
                      eventId={0}
                      basePrice={parseFloat(form.price)}
                      demandMultiplier={form.demandMultiplier}
                      onPriceUpdate={(newPrice, currency) => {
                        console.log("Price updated:", newPrice, currency);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Image Upload */}
              <div>
                <Label
                  htmlFor="image"
                  className="text-kaizen-white text-sm font-medium mb-2 block"
                >
                  Event Image
                </Label>
                <div className="relative">
                  <input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full px-3 py-2 bg-kaizen-dark-gray border border-kaizen-gray/30 text-kaizen-white rounded-md file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-kaizen-yellow file:text-kaizen-black hover:file:bg-kaizen-yellow/90 file:text-xs"
                  />
                </div>
                {image && (
                  <p className="text-kaizen-gray text-xs mt-2">
                    Selected: {image.name}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Advanced Features */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-kaizen-yellow mb-4">
                Advanced Features
              </h2>

              <Tabs defaultValue="features" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-9">
                  <TabsTrigger value="features" className="text-xs">
                    Features
                  </TabsTrigger>
                  <TabsTrigger value="staking" className="text-xs">
                    KALE Staking
                  </TabsTrigger>
                  <TabsTrigger value="pricing" className="text-xs">
                    Dynamic Pricing
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="features" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <input
                        id="enableKaleStaking"
                        name="enableKaleStaking"
                        type="checkbox"
                        checked={form.enableKaleStaking}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            enableKaleStaking: e.target.checked,
                          })
                        }
                        className="w-4 h-4 mt-0.5 text-kaizen-yellow bg-kaizen-dark-gray border-kaizen-gray rounded focus:ring-kaizen-yellow"
                      />
                      <div>
                        <Label
                          htmlFor="enableKaleStaking"
                          className="text-kaizen-white text-sm"
                        >
                          Enable KALE Token Staking
                        </Label>
                        <p className="text-kaizen-gray text-xs mt-1">
                          Require participants to stake KALE tokens for
                          commitment
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <input
                        id="enableDynamicPricing"
                        name="enableDynamicPricing"
                        type="checkbox"
                        checked={form.enableDynamicPricing}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            enableDynamicPricing: e.target.checked,
                          })
                        }
                        className="w-4 h-4 mt-0.5 text-kaizen-yellow bg-kaizen-dark-gray border-kaizen-gray rounded focus:ring-kaizen-yellow"
                      />
                      <div>
                        <Label
                          htmlFor="enableDynamicPricing"
                          className="text-kaizen-white text-sm"
                        >
                          Enable Dynamic Pricing via Reflector Oracle
                        </Label>
                        <p className="text-kaizen-gray text-xs mt-1">
                          Automatically adjust prices based on market conditions
                        </p>
                      </div>
                    </div>

                    <Alert className="mt-4">
                      <TrendingUp className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Hackathon Features:</strong> KALE staking
                        creates proof-of-commitment for organizers and
                        attendees. Dynamic pricing uses Reflector's live price
                        feeds for real-time market adjustments.
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>

                <TabsContent value="staking" className="mt-4">
                  {form.enableKaleStaking ? (
                    <KaleStaking
                      eventId={0}
                      eventTitle={form.title || "New Event"}
                      eventDate={form.date}
                      isOrganizer={true}
                      onStakeSuccess={(hash) =>
                        console.log("Stake success:", hash)
                      }
                    />
                  ) : (
                    <div className="text-center py-6 text-kaizen-gray text-sm">
                      Enable KALE staking in the Features tab to configure
                      staking options.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pricing" className="mt-4">
                  {form.enableDynamicPricing ? (
                    <div className="space-y-4">
                      <DynamicPricing
                        eventId={0}
                        basePrice={parseFloat(form.price) || 25}
                        demandMultiplier={form.demandMultiplier}
                        onPriceUpdate={(newPrice, currency) => {
                          console.log("Price updated:", newPrice, currency);
                        }}
                      />

                      <div>
                        <Label className="text-kaizen-white text-sm font-medium mb-2 block">
                          Demand Multiplier: {form.demandMultiplier.toFixed(1)}x
                        </Label>
                        <input
                          type="range"
                          min="0.8"
                          max="3.0"
                          step="0.1"
                          value={form.demandMultiplier}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              demandMultiplier: parseFloat(e.target.value),
                            })
                          }
                          className="w-full h-2 bg-kaizen-dark-gray rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-kaizen-gray mt-2">
                          <span>Low Demand</span>
                          <span>High Demand</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-kaizen-gray text-sm">
                      Enable dynamic pricing in the Features tab to configure
                      pricing options.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mx-4">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-4">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex-1 h-11 border-kaizen-gray text-kaizen-white hover:bg-kaizen-dark-gray"
              >
                Previous
              </Button>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 bg-kaizen-yellow text-kaizen-black hover:bg-kaizen-yellow/90 font-semibold rounded-xl"
            >
              {loading ? (
                "Creating Event..."
              ) : currentStep < 3 ? (
                "Next Step"
              ) : (
                <>
                  <Coins className="w-4 h-4 mr-2" />
                  Create Event
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Bottom spacing for mobile navigation */}
        <div className="pb-24"></div>
      </div>
    </div>
  );
}
