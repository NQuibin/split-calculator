// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { SharedPaymentHistory } from "./SharedPaymentHistory";

const history = [
  {
    key: "payment-1" as never,
    fromMemberId: "member-a" as never,
    toMemberId: "member-b" as never,
    from: "Alex",
    to: "Nikki",
    amount: 12.5,
    currency: "CAD",
    date: "2026-09-05",
    reversed: true,
    isReversal: false,
    reversedAt: 1,
    note: "Dinner",
  },
  {
    key: "payment-2" as never,
    fromMemberId: "member-b" as never,
    toMemberId: "member-a" as never,
    from: "Nikki",
    to: "Alex",
    amount: 12.5,
    currency: "CAD",
    date: "2026-09-05",
    reversed: false,
    isReversal: true,
    reversedAt: undefined,
    note: "Correction",
  },
  {
    key: "payment-3" as never,
    fromMemberId: "member-c" as never,
    toMemberId: "member-a" as never,
    from: "Sam",
    to: "Nikki",
    amount: 8,
    currency: "USD",
    date: "2026-09-04",
    reversed: false,
    isReversal: false,
    reversedAt: undefined,
    note: undefined,
  },
];

const roots: Root[] = [];

function mount(defaultOpen = false) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  flushSync(() => root.render(createElement(SharedPaymentHistory, { history, defaultOpen })));
  return container;
}

function click(element: Element) {
  flushSync(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) flushSync(() => root.unmount());
  document.body.replaceChildren();
});

test("opens grouped read-only payment history in a dialog", async () => {
  const container = mount();
  const trigger = container.querySelector<HTMLButtonElement>("button");
  expect(trigger?.textContent).toContain("Payment history");
  expect(trigger?.className).toContain("flex-1");
  expect(document.querySelector('[role="dialog"]')).toBeNull();

  click(trigger!);
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog.querySelector("[data-slot=dialog-title]")?.textContent).toBe("Payment history");
  expect(dialog.textContent).toContain("3 recorded payments.");
  expect(dialog.textContent).toContain("Alex");
  expect(dialog.textContent).toContain("Payment reversal");
  expect(dialog.textContent).toContain("Reversed");
  expect(dialog.textContent).toContain("Dinner");
  expect(dialog.textContent).toContain("Correction");
  expect(dialog.querySelectorAll('time[datetime="2026-09-05"]')).toHaveLength(1);
  expect(dialog.querySelectorAll('time[datetime="2026-09-04"]')).toHaveLength(1);
  expect(dialog.textContent).toContain("CAD");
  expect(dialog.textContent).toContain("USD");
  expect(dialog.querySelectorAll("button")).toHaveLength(1);
  expect(dialog.querySelector("button")?.getAttribute("aria-label")).toBe("Close payment history");
  expect(dialog.innerHTML).not.toContain("chevron-right");
});

test("default-opens for a legacy history URL and closes with the close button", async () => {
  const container = mount(true);
  const trigger = container.querySelector<HTMLButtonElement>("button")!;
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

  const closeButton = document.querySelector<HTMLButtonElement>(
    '[aria-label="Close payment history"]',
  )!;
  click(closeButton);
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

test("closes with Escape and restores focus to the trigger", async () => {
  const container = mount();
  const trigger = container.querySelector<HTMLButtonElement>("button")!;
  click(trigger);
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(document.activeElement).toBe(trigger);
});
