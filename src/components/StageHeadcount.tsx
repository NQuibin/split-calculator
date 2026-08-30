"use client";

import { useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { NumberStepper } from "@/components/ui/NumberStepper";
import type { Person } from "@/lib/types";

interface StageHeadcountProps {
  initialPeople: Person[];
  initialNamePeople: boolean;
  onConfirm: (people: Person[], namePeople: boolean) => void;
}

function defaultPeople(count: number): Person[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `person-${i + 1}`,
    name: `Person ${i + 1}`,
  }));
}

export function StageHeadcount({ initialPeople, initialNamePeople, onConfirm }: StageHeadcountProps) {
  const [count, setCount] = useState(initialPeople.length || 2);
  const [namePeople, setNamePeople] = useState(initialNamePeople);
  const [names, setNames] = useState<string[]>(() => {
    if (initialPeople.length > 0) return initialPeople.map((p) => p.name);
    return defaultPeople(count).map((p) => p.name);
  });

  function handleCountChange(next: number) {
    setCount(next);
    setNames((prev) => {
      const copy = prev.slice(0, next);
      while (copy.length < next) copy.push(`Person ${copy.length + 1}`);
      return copy;
    });
  }

  function handleContinue() {
    const people = Array.from({ length: count }, (_, i) => ({
      id: `person-${i + 1}`,
      name: namePeople ? names[i]?.trim() || `Person ${i + 1}` : `Person ${i + 1}`,
    }));
    onConfirm(people, namePeople);
  }

  return (
    <div className="mx-auto flex w-full min-h-[85vh] max-w-md flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex items-center gap-2 text-brass">
        <Users className="h-5 w-5" strokeWidth={2.25} />
        <span className="font-display text-sm font-semibold tracking-wide uppercase">
          Split Calculator
        </span>
      </div>

      <div className="space-y-3">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          How many people are splitting?
        </h1>
        <p className="text-ink-soft">Count everyone who&rsquo;s sharing this receipt.</p>
      </div>

      <NumberStepper value={count} onChange={handleCountChange} min={2} max={20} />

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={namePeople}
          onChange={(e) => setNamePeople(e.target.checked)}
          className="h-4 w-4 accent-forest"
        />
        Name each person instead of using &ldquo;Person 1, 2, 3&rdquo;
      </label>

      {namePeople && (
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: count }, (_, i) => (
            <input
              key={i}
              type="text"
              value={names[i] ?? ""}
              placeholder={`Person ${i + 1}`}
              onChange={(e) =>
                setNames((prev) => {
                  const copy = [...prev];
                  copy[i] = e.target.value;
                  return copy;
                })
              }
              className="rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40"
              aria-label={`Name for person ${i + 1}`}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-forest px-6 py-3 font-display font-semibold text-surface transition hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
      >
        Start the receipt
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
