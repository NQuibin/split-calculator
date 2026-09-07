import { createFileRoute } from "@tanstack/react-router";
import { TabsDirectory } from "@/components/Directories";

// The landing page is the tabs directory - it was a re-export of it in the
// Next app too (the old HomeClient).
export const Route = createFileRoute("/")({ component: TabsDirectory });
