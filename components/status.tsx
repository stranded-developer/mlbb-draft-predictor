"use client";

import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Status } from "@/lib/kb";

// Unproven knowledge is labelled "theory" everywhere it's shown.
export function TheoryBadge() {
  return (
    <Badge variant="outline" className="border-dashed border-amber-400/60 text-amber-300">
      theory
    </Badge>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return status === "theory" ? (
    <TheoryBadge />
  ) : (
    <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">
      confirmed
    </Badge>
  );
}

export function StatusToggle({
  value,
  onChange,
  disabled,
}: {
  value: Status;
  onChange: (s: Status) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[value]}
      onValueChange={(v) => v[0] && onChange(v[0] as Status)}
      disabled={disabled}
    >
      <ToggleGroupItem value="confirmed">Confirmed</ToggleGroupItem>
      <ToggleGroupItem value="theory">Theory</ToggleGroupItem>
    </ToggleGroup>
  );
}
