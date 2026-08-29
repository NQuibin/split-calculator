import type { ReactNode } from "react";

interface ReceiptStubProps {
  children: ReactNode;
  className?: string;
}

export function ReceiptStub({ children, className = "" }: ReceiptStubProps) {
  return (
    <div
      className={`torn-top rounded-b-lg bg-surface pt-5 shadow-[0_1px_0_rgba(30,42,34,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}
