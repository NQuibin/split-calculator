/**
 * The shared grid for tab expense rows. The list owns the desktop tracks and
 * rows subgrid onto it so date, payer, and money columns line up together.
 */
export function expenseListGridClass(withSettlement: boolean) {
  const list = withSettlement
    ? "divide-y divide-rule/70 @min-[38rem]:grid @min-[38rem]:gap-x-4 @min-[38rem]:grid-cols-[4.75rem_minmax(0,1fr)_fit-content(9rem)_fit-content(8rem)_minmax(6.75rem,max-content)] @min-[56rem]:gap-x-6 @min-[56rem]:grid-cols-[4.75rem_minmax(0,1fr)_fit-content(11rem)_fit-content(11rem)_minmax(6.75rem,max-content)]"
    : "divide-y divide-rule/70 @min-[38rem]:grid @min-[38rem]:gap-x-4 @min-[38rem]:grid-cols-[4.75rem_minmax(0,1fr)_fit-content(9rem)_fit-content(8rem)] @min-[56rem]:gap-x-6 @min-[56rem]:grid-cols-[4.75rem_minmax(0,1fr)_fit-content(11rem)_fit-content(11rem)]";
  return {
    list,
    row: "grid grid-cols-[auto_minmax(0,1fr)_fit-content(9.5rem)] items-start gap-x-4 gap-y-2 bleed-px @min-[38rem]:grid-cols-subgrid @min-[38rem]:col-span-full @min-[38rem]:items-center @min-[56rem]:gap-x-6",
  };
}
