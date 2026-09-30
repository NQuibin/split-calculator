/**
 * The shared grid for tab expense rows. The list owns the desktop tracks and
 * rows subgrid onto it so date, payer, and money columns line up together.
 */
export function expenseListGridClass(withSettlement: boolean) {
  const list = withSettlement
    ? "divide-y divide-rule/70 @min-[38rem]:grid @min-[38rem]:gap-x-4 @min-[38rem]:grid-cols-[4.75rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(6.75rem,max-content)_2.25rem] @min-[56rem]:gap-x-6"
    : "divide-y divide-rule/70 @min-[38rem]:grid @min-[38rem]:gap-x-4 @min-[38rem]:grid-cols-[4.75rem_minmax(0,1.5fr)_minmax(0,1fr)_2.25rem] @min-[56rem]:gap-x-6";
  return {
    list,
    row: withSettlement
      ? "grid grid-cols-[4rem_minmax(0,1fr)_fit-content(9.5rem)] items-start gap-x-4 gap-y-4 bleed-px @min-[38rem]:grid-cols-subgrid @min-[38rem]:col-span-full @min-[38rem]:items-center @min-[38rem]:gap-y-2 @min-[56rem]:gap-x-6"
      : "grid grid-cols-[4rem_minmax(0,1fr)_2.25rem] items-start gap-x-4 gap-y-4 bleed-px @min-[38rem]:grid-cols-subgrid @min-[38rem]:col-span-full @min-[38rem]:items-center @min-[38rem]:gap-y-2 @min-[56rem]:gap-x-6",
  };
}
