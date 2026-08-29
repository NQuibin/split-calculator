"use client";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="py-6 text-center text-xs text-ink-soft">
      &copy; {year} N Quibin
    </footer>
  );
}
