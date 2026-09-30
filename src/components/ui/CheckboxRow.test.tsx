// @vitest-environment happy-dom
import { expect, test } from "vitest";
import { renderMarkup } from "@/test/render";
import { CheckboxRow } from "./CheckboxRow";

test("renders the shared checked-circle indicator at the right edge of a touch row", () => {
  const markup = renderMarkup(
    <CheckboxRow selected onCheckedChange={() => undefined}>
      <span>Apply tip after tax</span>
    </CheckboxRow>,
  );

  expect(markup).toContain('class="sr-only"');
  expect(markup).toContain("min-h-11");
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain("ml-auto");
  expect(markup.indexOf("Apply tip after tax")).toBeLessThan(markup.indexOf('aria-hidden="true"'));
  expect(markup).toContain("border-forest bg-forest text-surface");
});

test("renders a content-sized checkbox with the indicator on the left and standard padding", () => {
  const markup = renderMarkup(
    <CheckboxRow selected onCheckedChange={() => undefined} layout="compact">
      <span>Record full amount</span>
    </CheckboxRow>,
  );

  expect(markup).toContain("w-fit");
  expect(markup).toContain("px-3 py-2");
  expect(markup).toContain("border-transparent");
  expect(markup).toContain("bg-surface");
  expect(markup).not.toContain("border-forest bg-field");
  expect(markup).not.toContain("ml-auto");
  expect(markup.indexOf('aria-hidden="true"')).toBeLessThan(markup.indexOf("Record full amount"));
});
