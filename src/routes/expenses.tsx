import { createFileRoute } from "@tanstack/react-router";
import { ExpensesDirectory } from "@/components/Directories";

export const Route = createFileRoute("/expenses")({ component: ExpensesDirectory });
