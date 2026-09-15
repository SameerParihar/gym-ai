import { Navigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import {
  Calendar,
  Dumbbell,
  RefreshCcw,
  Target,
  TrendingUp,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { PlanDisplay } from "../components/plan/PlanDisplay";

export default function Profile() {
  const { user, isLoading, plan, generatePlan } = useAuth();

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user && !isLoading) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  if (!plan) {
    return <Navigate to="/onboarding" replace />;
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleRegenerate() {
    setError(null);
    setIsRegenerating(true);

    try {
      await generatePlan();
    } catch (error) {
      console.error("Regenerate plan error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to regenerate training plan.");
      }
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">
              Your Training Plan
            </h1>

            <p className="text-[var(--color-muted)]">
              Version {plan.version} • Created{" "}
              {formatDate(plan.createdAt)}
            </p>
          </div>

          <Button
            variant="secondary"
            className="gap-2"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            <RefreshCcw
              className={`w-4 h-4 ${
                isRegenerating ? "animate-spin" : ""
              }`}
            />

            {isRegenerating
              ? "Regenerating..."
              : "Regenerate Plan"}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Card
            variant="bordered"
            className="mb-8 border-red-500"
          >
            <h2 className="font-semibold text-lg mb-2">
              Failed to regenerate plan
            </h2>

            <p className="text-sm text-red-400 break-words">
              {error}
            </p>
          </Card>
        )}

        {/* Plan Summary */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">

          {/* Goal */}
          <Card
            variant="bordered"
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <Target className="w-5 h-5 text-[var(--color-accent)]" />
            </div>

            <div>
              <p className="text-xs text-[var(--color-muted)]">
                Goal
              </p>

              <p className="font-medium text-sm">
                {plan.overview.goal}
              </p>
            </div>
          </Card>

          {/* Frequency */}
          <Card
            variant="bordered"
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
            </div>

            <div>
              <p className="text-xs text-[var(--color-muted)]">
                Frequency
              </p>

              <p className="font-medium text-sm">
                {plan.overview.frequency}
              </p>
            </div>
          </Card>

          {/* Split */}
          <Card
            variant="bordered"
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-[var(--color-accent)]" />
            </div>

            <div>
              <p className="text-xs text-[var(--color-muted)]">
                Split
              </p>

              <p className="font-medium text-sm">
                {plan.overview.split}
              </p>
            </div>
          </Card>

          {/* Version */}
          <Card
            variant="bordered"
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
            </div>

            <div>
              <p className="text-xs text-[var(--color-muted)]">
                Version
              </p>

              <p className="font-medium text-sm">
                {plan.version}
              </p>
            </div>
          </Card>

        </div>

        {/* Program Notes */}
        <Card variant="bordered" className="mb-8">
          <h2 className="font-semibold text-lg mb-2">
            Program Notes
          </h2>

          <p className="text-[var(--color-muted)] text-sm leading-relaxed">
            {plan.overview.notes}
          </p>
        </Card>

        {/* Weekly Schedule */}
        <h2 className="font-semibold text-xl mb-4">
          Weekly Schedule
        </h2>

        <PlanDisplay
          weeklySchedule={plan.weeklySchedule}
        />

        {/* Progression */}
        <Card variant="bordered" className="mb-8">
          <h2 className="font-semibold text-lg mb-3">
            Progression Strategy
          </h2>

          <p className="text-[var(--color-accent)] font-medium mb-3">
            {plan.progression.method}
          </p>

          <ul className="space-y-2">
            {plan.progression.guidelines.map(
              (guideline, index) => (
                <li
                  key={index}
                  className="text-[var(--color-muted)] text-sm leading-relaxed flex gap-2"
                >
                  <span>•</span>
                  <span>{guideline}</span>
                </li>
              ),
            )}
          </ul>
        </Card>

      </div>
    </div>
  );
}