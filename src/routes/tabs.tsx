import { createFileRoute } from "@tanstack/react-router";
import { TabsDirectory } from "@/components/Directories";

export const Route = createFileRoute("/tabs")({ component: TabsDirectory });
