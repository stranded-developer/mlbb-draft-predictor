"use client";

import { useState } from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HEROES } from "@/lib/heroes";
import { HeroChip } from "./hero-avatar";

// Searchable hero picker: type part of a name to autocomplete.
export function HeroCombobox({
  value,
  onChange,
  placeholder = "Choose hero…",
  disabled,
}: {
  value: string;
  onChange: (slug: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={<Button variant="outline" className="w-full justify-between font-normal" />}
      >
        {value ? <HeroChip slug={value} /> : <span className="text-muted-foreground">{placeholder}</span>}
        <ChevronsUpDownIcon className="size-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a hero name…" autoFocus />
          <CommandList>
            <CommandEmpty>No hero found.</CommandEmpty>
            {HEROES.map((h) => (
              <CommandItem
                key={h.slug}
                value={h.name}
                onSelect={() => {
                  onChange(h.slug);
                  setOpen(false);
                }}
              >
                <HeroChip slug={h.slug} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
