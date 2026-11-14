import { type ReactNode, useEffect, useRef, useState } from "react";
import { toISODate } from "@/lib/format";

const lastMinute = 23 * 60 + 59;

function minutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function ItineraryTimeRail({ date, children }: { date: string; children: ReactNode }) {
  const listRef = useRef<HTMLOListElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState(() => new Date());
  const today = toISODate(clock);
  const currentMinute = clock.getHours() * 60 + clock.getMinutes();
  const progress = date < today ? lastMinute : date > today ? 0 : currentMinute;

  useEffect(() => {
    const refresh = () => setClock(new Date());
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reobserve cards when entries are added, moved, or edited.
  useEffect(() => {
    const list = listRef.current;
    const fill = fillRef.current;
    const ticker = markerRef.current;
    if (!list || !fill) return;

    function measure() {
      if (!list || !fill) return;
      const bounds = list.getBoundingClientRect();
      const anchors = new Map<number, number>([
        [0, 0],
        [lastMinute, bounds.height],
      ]);
      for (const card of list.children) {
        if (!(card instanceof HTMLElement) || !card.dataset.time) continue;
        const minute = minutes(card.dataset.time);
        if (!anchors.has(minute))
          anchors.set(minute, card.getBoundingClientRect().top - bounds.top);
      }
      // Interpolate between card tops because cards have different heights.
      const points = [...anchors.entries()].sort(([a], [b]) => a - b);
      const nextIndex = points.findIndex(([minute]) => minute >= progress);
      const [nextMinute, nextTop] = points[nextIndex];
      const [previousMinute, previousTop] = points[Math.max(0, nextIndex - 1)];
      const fraction =
        nextMinute === previousMinute
          ? 0
          : (progress - previousMinute) / (nextMinute - previousMinute);
      const marker = previousTop + fraction * (nextTop - previousTop);
      fill.style.height = `${marker}px`;
      if (ticker) ticker.style.top = `${marker}px`;
    }

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const card of list.children) observer.observe(card);
    return () => observer.disconnect();
  }, [children, progress, date, today]);

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 -left-3 w-1 rounded-full bg-rule sm:-left-4"
      >
        <div ref={fillRef} className="absolute inset-x-0 top-0 rounded-full bg-forest" />
      </div>
      {date === today && (
        <div
          ref={markerRef}
          aria-hidden="true"
          className="absolute -left-4 size-3 -translate-y-1/2 rounded-full border-2 border-surface bg-forest sm:-left-5"
        />
      )}
      <span className="sr-only">
        {date < today
          ? "Day elapsed"
          : date > today
            ? "Day has not started"
            : `Current local time ${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`}
      </span>
      <ol ref={listRef}>{children}</ol>
    </div>
  );
}
