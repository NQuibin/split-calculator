"use client";

import { Wallet } from "lucide-react";
import { currency } from "@/lib/format";
import type { GroupBreakdown as GroupBreakdownData } from "@/lib/groupSync";

interface GroupBreakdownProps {
  breakdown: GroupBreakdownData;
}

export function GroupBreakdown({ breakdown }: GroupBreakdownProps) {
  return (
    <div className="rounded-md border border-rule bg-surface p-5">
      <p className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
        <Wallet className="h-4 w-4 text-brass" strokeWidth={2.25} />
        Group balance across {breakdown.receiptCount} {breakdown.receiptCount === 1 ? "receipt" : "receipts"}
      </p>
      {breakdown.members.length === 0 ? (
        <p className="text-sm text-ink-soft">No members yet.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {breakdown.members.map((member) => (
            <li key={member.memberId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-ink">
                  {member.name}
                  {member.claimed && (
                    <span className="ml-1.5 text-xs font-medium text-forest">· claimed</span>
                  )}
                </p>
                <p className="text-xs text-ink-soft">
                  {member.receiptCount} {member.receiptCount === 1 ? "receipt" : "receipts"} · spent{" "}
                  {currency(member.totalSpent)}
                </p>
              </div>
              {member.netBalance > 0.005 ? (
                <span className="font-numeric shrink-0 font-semibold text-forest">
                  Gets back {currency(member.netBalance)}
                </span>
              ) : member.netBalance < -0.005 ? (
                <span className="font-numeric shrink-0 font-semibold text-margin-red">
                  Still needs to front {currency(-member.netBalance)}
                </span>
              ) : (
                <span className="font-numeric shrink-0 text-ink-soft">Settled up</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
