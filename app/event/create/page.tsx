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
    <div className="min-h-screen bg-kaizen-black text-kaizen-white max-w-2xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-8">
        <Button
          variant="ghost"
          onClick={() =>
            currentStep > 1 ? setCurrentStep(currentStep - 1) : router.back()
          }
          className="text-kaizen-white hover:bg-kaizen-dark-gray"
        >
          ← Back
        </Button>
        <h1 className="text-xl font-bold">Create Event ({currentStep}/3)</h1>
        <div className="w-16"></div>
      </div>

      {/* Progress Steps */}
      <div className="flex mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex-1 flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Basic Event Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-kaizen-yellow mb-4">
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
                  className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white placeholder:text-kaizen-gray"
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
                  rows={4}
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
                  className="w-full px-3 py-2 bg-kaizen-dark-gray border border-kaizen-gray/30 text-kaizen-white rounded-md focus:outline-none focus:ring-2 focus:ring-kaizen-yellow"
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
                  className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white placeholder:text-kaizen-gray"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Date, Time & Pricing */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-kaizen-yellow mb-4">
              Schedule & Pricing
            </h2>

            {/* Date & Time */}
            <div className="space-y-4">
              <h3 className="text-kaizen-white font-semibold flex items-center gap-2">
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
                    className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white"
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
                    className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white"
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
                    className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white placeholder:text-kaizen-gray"
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
                    className="bg-kaizen-dark-gray border-kaizen-gray/30 text-kaizen-white placeholder:text-kaizen-gray"
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
                  className="w-full px-3 py-2 bg-kaizen-dark-gray border border-kaizen-gray/30 text-kaizen-white rounded-md file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-kaizen-yellow file:text-kaizen-black hover:file:bg-kaizen-yellow/90"
                />
              </div>
              {image && (
                <p className="text-kaizen-gray text-xs mt-1">
                  Selected: {image.name}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Advanced Features */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-kaizen-yellow mb-4">
              Advanced Features
            </h2>

            <Tabs defaultValue="features" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="staking">KALE Staking</TabsTrigger>
                <TabsTrigger value="pricing">Dynamic Pricing</TabsTrigger>
              </TabsList>

              <TabsContent value="features" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
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
                      className="w-4 h-4 text-kaizen-yellow bg-kaizen-dark-gray border-kaizen-gray rounded focus:ring-kaizen-yellow"
                    />
                    <Label
                      htmlFor="enableKaleStaking"
                      className="text-kaizen-white"
                    >
                      Enable KALE Token Staking
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3">
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
                      className="w-4 h-4 text-kaizen-yellow bg-kaizen-dark-gray border-kaizen-gray rounded focus:ring-kaizen-yellow"
                    />
                    <Label
                      htmlFor="enableDynamicPricing"
                      className="text-kaizen-white"
                    >
                      Enable Dynamic Pricing via Reflector Oracle
                    </Label>
                  </div>

                  <Alert>
                    <TrendingUp className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Hackathon Features:</strong> KALE staking creates
                      proof-of-commitment for organizers and attendees. Dynamic
                      pricing uses Reflector's live price feeds for real-time
                      market adjustments.
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>

              <TabsContent value="staking">
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
                  <div className="text-center py-8 text-kaizen-gray">
                    Enable KALE staking in the Features tab to configure staking
                    options.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pricing">
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
                      <div className="flex justify-between text-xs text-kaizen-gray mt-1">
                        <span>Low Demand</span>
                        <span>High Demand</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-kaizen-gray">
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
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex-1 border-kaizen-gray text-kaizen-white hover:bg-kaizen-dark-gray"
            >
              Previous
            </Button>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="flex-1 bg-kaizen-yellow text-kaizen-black hover:bg-kaizen-yellow/90 font-semibold py-3 rounded-xl"
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

      <div className="pb-20"></div>
    </div>
  );
}
