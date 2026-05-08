"use client";

import { Button } from "@/components/ui/button";

export type TabOption = { id: string; label: string };

export function Tabs({
  options,
  activeId,
  onChange,
}: {
  options: TabOption[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Section tabs"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      {options.map((option) => {
        const active = option.id === activeId;
        return (
          <Button
            key={option.id}
            type="button"
            variant={active ? "outline" : "ghost"}
            size="md"
            onClick={() => onChange(option.id)}
            role="tab"
            aria-selected={active}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
