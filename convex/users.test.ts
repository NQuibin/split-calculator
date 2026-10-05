/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("updateSettings saves name and currency together and rejects an empty name atomically", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Before", defaultCurrency: "USD" }),
  );
  const user = t.withIdentity({ subject: `${userId}|session` });

  await user.mutation(api.users.updateSettings, { name: "  Ada  ", currency: "CAD" });
  expect(await user.query(api.users.viewer, {})).toMatchObject({
    name: "Ada",
    defaultCurrency: "CAD",
  });

  await expect(
    user.mutation(api.users.updateSettings, { name: "  ", currency: "EUR" }),
  ).rejects.toThrow("Name is required");
  expect(await user.query(api.users.viewer, {})).toMatchObject({
    name: "Ada",
    defaultCurrency: "CAD",
  });
});
