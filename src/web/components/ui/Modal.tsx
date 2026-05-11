import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  type?: "info" | "warning" | "error" | "success" | "confirm";
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  isLoading?: boolean;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  type = "info",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  isLoading = false,
  maxWidth = "max-w-md",
}: ModalProps) {
  const icons = {
    info: <Info className="w-6 h-6 text-blue-400" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-400" />,
    error: <AlertCircle className="w-6 h-6 text-red-400" />,
    success: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
    confirm: <AlertCircle className="w-6 h-6 text-primary" />,
  };

  const colors = {
    info: "bg-blue-500/10 text-blue-500",
    warning: "bg-amber-500/10 text-amber-500",
    error: "bg-red-500/10 text-red-500",
    success: "bg-emerald-500/10 text-emerald-500",
    confirm: "bg-primary/10 text-primary",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative w-full bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden",
              maxWidth
            )}
          >
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-2xl", colors[type])}>
                    {icons[type]}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100">{title}</h3>
                    {description && (
                      <p className="text-sm text-zinc-500 mt-1">{description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-8">
                {children}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {type === "confirm" || onConfirm ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      disabled={isLoading}
                      className="flex-1 text-zinc-500 hover:text-zinc-300 order-2 sm:order-1"
                    >
                      {cancelText}
                    </Button>
                    <Button
                      onClick={onConfirm}
                      disabled={isLoading}
                      className={cn(
                        "flex-1 py-6 text-base font-bold order-1 sm:order-2",
                        type === "error" ? "bg-red-600 hover:bg-red-500" : ""
                      )}
                    >
                      {isLoading ? "Processing..." : confirmText}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={onClose}
                    className="w-full py-6 text-base font-bold"
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
