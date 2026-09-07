import { createFileRoute } from "@tanstack/react-router";
import { FriendsDirectory } from "@/components/Directories";

export const Route = createFileRoute("/friends")({ component: FriendsDirectory });
