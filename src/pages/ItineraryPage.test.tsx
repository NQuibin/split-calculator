// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { costaRica } from "@/lib/costaRicaItinerary";
import { ItineraryPage } from "./ItineraryPage";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    search,
    "aria-current": current,
  }: {
    children: React.ReactNode;
    className?: string;
    search?: { day: string };
    "aria-current"?: "page";
  }) => (
    <a
      className={className}
      href={search ? `/itineraries/trip?day=${search.day}` : "/itineraries"}
      aria-current={current}
    >
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("@convex-dev/react-query", () => ({ convexQuery: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      ...costaRica,
      _id: "trip",
      entries: costaRica.entries.map((entry, index) => ({
        ...entry,
        id: String(index),
        kind:
          entry.kind === "flight" || entry.title === "Pick up rental car"
            ? "travel"
            : entry.title === "La Fortuna Waterfall"
              ? "attraction"
              : entry.kind,
        subtype:
          entry.kind === "flight"
            ? "flight"
            : entry.title === "Pick up rental car"
              ? "car"
              : entry.title === "Airbnb check-in"
                ? "bnb"
                : entry.title === "La Fortuna Waterfall"
                  ? "viewpoint"
                  : undefined,
        flight:
          entry.kind === "flight"
            ? {
                number: "AC 123",
                departureTime: "08:15",
                arrivalTime: "12:35",
                departureCity: "Toronto",
                departureAirportCode: "YYZ",
                destinationCity: "Liberia",
                destinationAirportCode: "LIR",
              }
            : undefined,
        lodging:
          entry.title === "Airbnb check-in"
            ? {
                checkIn: "18:00",
                checkOut: "10:00",
                checkInDate: "2026-11-17",
                checkOutDate: "2026-11-22",
              }
            : undefined,
        location:
          entry.title === "La Fortuna Waterfall"
            ? { name: "La Fortuna Waterfall entrance", url: "https://example.com/waterfall" }
            : entry.title === "Airbnb check-in"
              ? { name: "La Fortuna lodging", url: "https://example.com/lodging" }
              : undefined,
      })),
    },
  }),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
}));

test("switches the Costa Rica timeline between trip dates", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 13));
  try {
    await act(async () => root.render(<ItineraryPage id="trip" />));
    const days = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Itinerary days"] a'),
    );
    expect(days.map((button) => button.textContent)).toEqual([
      "Day 1Nov 17",
      "Day 2Nov 18",
      "Day 3Nov 19",
      "Day 4Nov 20",
      "Day 5Nov 21",
      "Day 6Nov 22",
      "Day 7Nov 23",
      "Day 8Nov 24",
    ]);
    expect(days[0].getAttribute("aria-current")).toBe("page");
    expect(days[0].classList.contains("bg-primary")).toBe(true);
    expect(days[1].classList.contains("border-forest")).toBe(true);
    expect(days[1].classList.contains("border-transparent")).toBe(false);
    expect(container.textContent).toContain("Arrive at Liberia Airport");
    const [travel, lodging] = container.querySelectorAll("details");
    expect(travel?.querySelector("summary")?.textContent).toBe("Travel");
    expect(lodging?.querySelector("summary")?.textContent).toBe("Lodging");
    expect(travel?.open).toBe(false);
    expect(lodging?.open).toBe(false);
    expect(travel?.textContent).toContain("Local arrival time12:35");
    expect(travel?.textContent).toContain("Toronto (YYZ)");
    expect(travel?.textContent).toContain("Pick up rental car");
    expect(travel?.textContent).toContain("Car13:30");
    expect(lodging?.textContent).toContain("BnB");
    expect(travel?.textContent).toContain("Liberia (LIR)");
    expect(lodging?.querySelector('time[datetime="2026-11-22"]')).not.toBeNull();
    expect(travel?.textContent).not.toContain("Airbnb check-in");
    expect(lodging?.textContent).not.toContain("Arrive at Liberia Airport");
    travel.open = true;
    expect(lodging.open).toBe(false);
    const timeline = container.querySelector('section[aria-labelledby="timeline-heading"]');
    const flightDetails = timeline?.querySelector("dl");
    expect(flightDetails?.textContent).toContain("Toronto (YYZ)");
    expect(flightDetails?.textContent).toContain("Liberia (LIR)");
    expect(flightDetails?.textContent).toContain("Flight numberAC 123");
    expect(flightDetails?.querySelector("time")?.dateTime).toBe("08:15");
    expect(container.querySelector('time[datetime="2026-11-17T12:35"]')?.textContent).toBe("12:35");
    expect(container.textContent).toContain("Airbnb check-in");
    const lodgingRow = Array.from(timeline?.querySelectorAll("li") ?? []).find((row) =>
      row.textContent?.includes("Airbnb check-in"),
    );
    expect(lodgingRow?.textContent).toContain("Freshen up.");
    expect(lodgingRow?.textContent).toContain("Lodging details");
    expect(lodgingRow?.querySelector('a[href="https://example.com/lodging"]')?.textContent).toBe(
      "La Fortuna lodging",
    );
    expect(lodgingRow?.querySelector("dl")?.textContent).toContain(
      "Local check-inNov 17, 202618:00",
    );
    expect(lodgingRow?.querySelector("dl")?.textContent).toContain(
      "Local check-outNov 22, 202610:00",
    );
    expect(container.textContent).not.toContain("La Fortuna Waterfall");

    expect(days[1].getAttribute("href")).toBe("/itineraries/trip?day=2026-11-18");
    await act(async () => root.render(<ItineraryPage id="trip" day="2026-11-18" />));
    expect(timeline?.textContent).not.toContain("Arrive at Liberia Airport");
    expect(travel?.textContent).toContain("Arrive at Liberia Airport");
    expect(container.textContent).not.toContain("Flight details");
    expect(container.textContent).toContain("La Fortuna Waterfall");
    const location = container.querySelector('a[href="https://example.com/waterfall"]');
    expect(location?.textContent).toBe("La Fortuna Waterfall entrance");
    expect(location?.parentElement?.parentElement?.textContent).toContain("Attraction · Viewpoint");
    expect(location?.closest("li")?.querySelector("svg.lucide-mountain")).not.toBeNull();
    expect(travel?.textContent).not.toContain("La Fortuna Waterfall");
    expect(lodging?.textContent).not.toContain("La Fortuna Waterfall");
    expect(location?.parentElement?.parentElement?.textContent).toContain("$20 USD plus tax.");
    const actions = container.querySelector(
      'button[aria-label="Actions for La Fortuna Waterfall"]',
    );
    expect(actions?.classList.contains("sm:hidden")).toBe(true);
    expect(days[0].getAttribute("aria-current")).toBeNull();
    expect(days[1].getAttribute("aria-current")).toBe("page");

    vi.setSystemTime(new Date(2026, 10, 17));
    await act(async () => root.render(<ItineraryPage id="trip" />));
    expect(days[0].getAttribute("aria-current")).toBe("page");

    vi.setSystemTime(new Date(2026, 10, 18));
    await act(async () => root.render(<ItineraryPage id="trip" />));
    expect(container.textContent).toContain("Check out of Occidental Papagayo");
    expect(days[7].getAttribute("aria-current")).toBe("page");

    await act(async () => root.render(<ItineraryPage id="trip" day="2026-11-99" />));
    expect(days[7].getAttribute("aria-current")).toBe("page");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  }
});
