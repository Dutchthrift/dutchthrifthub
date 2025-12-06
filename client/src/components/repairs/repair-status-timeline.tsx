import { Badge } from "@/components/ui/badge";
import { Check, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineStep {
  id: string;
  label: string;
  color: string;
}

const WORKFLOW_STEPS: TimelineStep[] = [
  { id: "new", label: "Nieuw", color: "bg-blue-500" },
  { id: "in_repair", label: "In Reparatie", color: "bg-orange-500" },
  { id: "completed", label: "Klaar", color: "bg-green-500" },
  { id: "returned", label: "Teruggestuurd", color: "bg-purple-500" },
];

interface RepairStatusTimelineProps {
  currentStatus: string;
}

export function RepairStatusTimeline({ currentStatus }: RepairStatusTimelineProps) {
  const steps = WORKFLOW_STEPS;
  const currentStepIndex = steps.findIndex(step => step.id === currentStatus);
  // Handle unknown status by defaulting to first step
  const effectiveIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  const progressPercentage = Math.round(((effectiveIndex + 1) / steps.length) * 100);

  return (
    <div className="py-4" data-testid="repair-timeline">
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-muted" data-testid="timeline-background" />
        <div
          className="absolute left-4 top-8 w-0.5 bg-primary transition-all duration-500"
          style={{ height: `${progressPercentage}%` }}
          data-testid="timeline-progress"
        />

        {/* Steps */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const isCompleted = index < effectiveIndex;
            const isCurrent = index === effectiveIndex;
            const isPending = index > effectiveIndex;

            return (
              <div
                key={step.id}
                className="relative flex items-center gap-4"
                data-testid={`timeline-step-${step.id}`}
              >
                {/* Step Icon */}
                <div className="relative z-10">
                  {isCompleted ? (
                    <div className={cn("rounded-full p-1.5", step.color)}>
                      <Check className="h-3 w-3 text-white" data-testid={`step-icon-completed-${step.id}`} />
                    </div>
                  ) : isCurrent ? (
                    <div className={cn("rounded-full p-1.5 ring-4 ring-background", step.color)}>
                      <div className="h-3 w-3 rounded-full bg-white" data-testid={`step-icon-current-${step.id}`} />
                    </div>
                  ) : (
                    <div className="rounded-full p-1.5 bg-muted">
                      <Circle className="h-3 w-3 text-muted-foreground" data-testid={`step-icon-pending-${step.id}`} />
                    </div>
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1">
                  <div className={cn(
                    "font-medium transition-colors",
                    isCurrent && "text-foreground",
                    isCompleted && "text-foreground",
                    isPending && "text-muted-foreground"
                  )} data-testid={`step-label-${step.id}`}>
                    {step.label}
                  </div>
                  {isCurrent && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Huidige status
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                {isCurrent && (
                  <Badge className={step.color} data-testid={`badge-current-${step.id}`}>
                    Actief
                  </Badge>
                )}
                {isCompleted && (
                  <Badge variant="outline" data-testid={`badge-completed-${step.id}`}>
                    Voltooid
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Percentage */}
      <div className="mt-6 pt-4 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Voortgang</span>
          <span className="font-medium" data-testid="timeline-percentage">
            {progressPercentage}%
          </span>
        </div>
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
            data-testid="timeline-progress-bar"
          />
        </div>
      </div>
    </div>
  );
}
