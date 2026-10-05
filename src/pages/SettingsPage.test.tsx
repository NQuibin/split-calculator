// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  save: vi.fn(async (_args: { name: string; currency: string }) => {}),
}));

vi.mock("convex/react", () => ({
  Authenticated: ({ children }: { children: React.ReactNode }) => children,
  AuthLoading: () => null,
  Unauthenticated: () => null,
  useQuery: () => ({
    _id: "user-1",
    name: "Nikki",
    email: "nikki@example.com",
    defaultCurrency: "USD",
  }),
  useMutation: () => mocks.save,
}));
vi.mock("@/components/ui/CurrencyPicker", () => ({
  CurrencyPicker: ({ onChange }: { onChange: (code: string) => void }) =>
    createElement("button", { type: "button", onClick: () => onChange("CAD") }, "USD"),
}));

import { SettingsPage } from "./SettingsPage";

test("saves name and currency together while email stays read-only", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(SettingsPage)));

  const email = container.querySelector<HTMLInputElement>("#settings-email")!;
  expect(email.readOnly).toBe(true);
  expect(email.value).toBe("nikki@example.com");
  expect(email.classList.contains("bg-paper")).toBe(true);

  const name = container.querySelector<HTMLInputElement>("#settings-name")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "Ada");
    name.dispatchEvent(new Event("input", { bubbles: true }));
    container.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
  });
  expect(mocks.save).not.toHaveBeenCalled();

  await act(async () =>
    container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(),
  );
  expect(mocks.save).toHaveBeenCalledWith({ name: "Ada", currency: "CAD" });
  await act(async () => root.unmount());
  container.remove();
});
