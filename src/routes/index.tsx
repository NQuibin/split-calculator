import { createFileRoute } from "@tanstack/react-router";
import { TabsDirectory } from "@/components/Directories";

// The landing page is the tabs directory.
export const Route = createFileRoute("/")({ component: TabsDirectory });
