import { createFileRoute } from "@tanstack/react-router";
import { TabBreakdownPage } from "@/pages/TabBreakdownPage";

export const Route = createFileRoute("/t/$slug/breakdown")({ component: TabBreakdownPage });
