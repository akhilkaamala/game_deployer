import React from "react";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export type StepStatus = "pending" | "running" | "success" | "error";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

interface DeploymentStepperProps {
  steps: Step[];
}

export function DeploymentStepper({ steps }: DeploymentStepperProps) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={step.id} className="relative flex items-center gap-4">
          {index !== steps.length - 1 && (
            <div 
              className={cn(
                "absolute left-[11px] top-7 w-[2px] h-6 bg-border transition-colors duration-500",
                step.status === "success" && "bg-emerald-500"
              )} 
            />
          )}
          
          <div className="relative z-10">
            {step.status === "success" && (
              <CheckCircle2 className="w-6 h-6 text-emerald-500 bg-background" />
            )}
            {step.status === "running" && (
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin bg-background" />
            )}
            {step.status === "error" && (
              <AlertCircle className="w-6 h-6 text-red-500 bg-background" />
            )}
            {step.status === "pending" && (
              <Circle className="w-6 h-6 text-zinc-300 bg-background" />
            )}
          </div>

          <div className="flex flex-col">
            <span className={cn(
              "text-sm font-medium transition-colors",
              step.status === "running" ? "text-blue-500" : 
              step.status === "success" ? "text-zinc-400" : "text-zinc-500"
            )}>
              {step.label}
            </span>
            {step.status === "running" && (
              <span className="text-[10px] text-blue-400 animate-pulse">In progress...</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
