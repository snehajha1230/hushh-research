// components/kai/modals/edit-holding-modal.tsx

/**
 * Edit Holding Modal - Modal for editing individual holdings
 *
 * Features:
 * - Pre-filled form with current values
 * - Fields: symbol, name, quantity, price, cost basis, acquisition date
 * - Validation for numeric fields
 * - Save/Cancel buttons
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Calendar, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/lib/morphy-ux/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

// =============================================================================
// TYPES
// =============================================================================

interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  market_value: number;
  cost_basis?: number;
  unrealized_gain_loss?: number;
  unrealized_gain_loss_pct?: number;
  acquisition_date?: string;
}

interface EditHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  holding: Holding | null;
  onSave: (holding: Holding) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EditHoldingModal({
  isOpen,
  onClose,
  holding,
  onSave,
}: EditHoldingModalProps) {
  const acquisitionDateInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState<Holding>({
    symbol: "",
    name: "",
    quantity: 0,
    price: 0,
    market_value: 0,
    cost_basis: 0,
    acquisition_date: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when holding changes
  useEffect(() => {
    if (holding) {
      setFormData({
        symbol: holding.symbol || "",
        name: holding.name || "",
        quantity: holding.quantity || 0,
        price: holding.price || 0,
        market_value: holding.market_value || 0,
        cost_basis: holding.cost_basis || 0,
        unrealized_gain_loss: holding.unrealized_gain_loss,
        unrealized_gain_loss_pct: holding.unrealized_gain_loss_pct,
        acquisition_date: holding.acquisition_date || "",
      });
      setErrors({});
    }
  }, [holding]);

  // Update market value when quantity or price changes
  useEffect(() => {
    const marketValue = formData.quantity * formData.price;
    const gainLoss = formData.cost_basis ? marketValue - formData.cost_basis : 0;
    const gainLossPct = formData.cost_basis && formData.cost_basis > 0 
      ? (gainLoss / formData.cost_basis) * 100 
      : 0;

    setFormData(prev => ({
      ...prev,
      market_value: marketValue,
      unrealized_gain_loss: gainLoss,
      unrealized_gain_loss_pct: gainLossPct,
    }));
  }, [formData.quantity, formData.price, formData.cost_basis]);

  // Handle input change
  const handleChange = useCallback((field: keyof Holding, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.symbol.trim()) {
      newErrors.symbol = "Symbol is required";
    } else if (!/^[A-Z]{0,5}$/.test(formData.symbol.toUpperCase())) {
      newErrors.symbol = "Invalid symbol format (0-5 letters)";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (formData.quantity < 0) {
      newErrors.quantity = "Quantity must be 0 or greater";
    }

    if (formData.price < 0) {
      newErrors.price = "Price must be 0 or greater";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!validate()) return;

    onSave({
      ...formData,
      symbol: formData.symbol.toUpperCase(),
    });
  }, [formData, validate, onSave]);

  const handleOpenDatePicker = useCallback(() => {
    const input = acquisitionDateInputRef.current;
    if (!input) return;

    // showPicker is supported in modern Chromium; click/focus fallback keeps Safari/iOS usable.
    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      return;
    } catch {
      // no-op: fallback below
    }
    input.focus({ preventScroll: true });
    input.click();
  }, []);

  const formatAcquisitionDate = useCallback((value?: string) => {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${month}/${day}/${year}`;
  }, []);

  const isNewHolding = !holding?.symbol;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {isNewHolding ? "Add Holding" : "Edit Holding"}
          </DrawerTitle>
          <DrawerDescription>
            Update your portfolio details securely. All changes are encrypted.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 py-2 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Symbol */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Symbol <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => handleChange("symbol", e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              maxLength={5}
              className={cn(
                "w-full px-3 py-2 rounded-lg border bg-background outline-none transition-colors",
                errors.symbol
                  ? "border-red-500 focus:border-red-500"
                  : "border-border focus:border-primary"
              )}
            />
            {errors.symbol && (
              <p className="text-sm text-red-500 mt-1">{errors.symbol}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., Apple Inc."
              className={cn(
                "w-full px-3 py-2 rounded-lg border bg-background outline-none transition-colors",
                errors.name
                  ? "border-red-500 focus:border-red-500"
                  : "border-border focus:border-primary"
              )}
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Quantity & Price Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.quantity || ""}
                onChange={(e) => handleChange("quantity", parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
                step="0.0001"
                className={cn(
                  "w-full px-4 py-3 h-12 rounded-xl border bg-background outline-none transition-colors",
                  errors.quantity
                    ? "border-red-500 focus:border-red-500"
                    : "border-border focus:border-primary"
                )}
              />
              {errors.quantity && (
                <p className="text-sm text-red-500 mt-1">{errors.quantity}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.price || ""}
                onChange={(e) => handleChange("price", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={cn(
                  "w-full px-4 py-3 h-12 rounded-xl border bg-background outline-none transition-colors",
                  errors.price
                    ? "border-red-500 focus:border-red-500"
                    : "border-border focus:border-primary"
                )}
              />
              {errors.price && (
                <p className="text-sm text-red-500 mt-1">{errors.price}</p>
              )}
            </div>
          </div>

          {/* Market Value (calculated, read-only) */}
          <div>
            <label className="block text-sm text-muted-foreground font-medium mb-1">
              Market Value (Auto-calculated)
            </label>
            <input
              type="text"
              value={`$${formData.market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              readOnly
              className="w-full px-4 py-3 h-12 rounded-xl border border-border bg-muted/50 text-muted-foreground font-medium"
            />
          </div>

          {/* Cost Basis */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Cost Basis (Total)
            </label>
            <input
              type="number"
              value={formData.cost_basis || ""}
              onChange={(e) => handleChange("cost_basis", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-4 py-3 h-12 rounded-xl border border-border bg-background outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Acquisition Date */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Acquisition Date
            </label>
            <div className="relative">
              <input
                type="text"
                value={formatAcquisitionDate(formData.acquisition_date)}
                placeholder="MM/DD/YYYY"
                readOnly
                onClick={handleOpenDatePicker}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpenDatePicker();
                  }
                }}
                className="w-full px-4 py-3 pr-12 h-12 rounded-xl border border-border bg-background outline-none focus:border-primary transition-colors cursor-pointer"
              />
              <button
                type="button"
                onClick={handleOpenDatePicker}
                aria-label="Open acquisition date picker"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                <Calendar className="h-4 w-4" />
              </button>
              <input
                ref={acquisitionDateInputRef}
                type="date"
                value={formData.acquisition_date || ""}
                onChange={(e) => handleChange("acquisition_date", e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
                className="absolute h-px w-px opacity-0 pointer-events-none"
              />
            </div>
          </div>

          {/* Gain/Loss Preview */}
          {formData.cost_basis !== undefined && formData.cost_basis > 0 && (
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
              <p className="text-sm text-muted-foreground font-medium">Unrealized Gain/Loss</p>
              <p
                className={cn(
                  "text-xl font-bold mt-1",
                  (formData.unrealized_gain_loss || 0) >= 0
                    ? "text-emerald-500"
                    : "text-red-500"
                )}
              >
                ${(formData.unrealized_gain_loss || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {" "}
                <span className="text-sm font-medium opacity-80">
                  ({(formData.unrealized_gain_loss_pct || 0) >= 0 ? "+" : ""}
                  {(formData.unrealized_gain_loss_pct || 0).toFixed(2)}%)
                </span>
              </p>
            </div>
          )}
        </div>
 
        <DrawerFooter className="border-t bg-background/80 backdrop-blur-lg pb-[calc(5rem+var(--app-safe-area-bottom-effective))]">
          <div className="flex gap-3 w-full">
            <DrawerClose asChild>
              <Button
                variant="none"
                effect="glass"
                className="flex-1 h-12 border"
              >
                Cancel
              </Button>
            </DrawerClose>
            <Button
              onClick={handleSave}
              className="flex-1 h-12"
              icon={{ icon: Save, gradient: false }}
            >
              {isNewHolding ? "Add" : "Save Changes"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
