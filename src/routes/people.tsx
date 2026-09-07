import { createFileRoute } from "@tanstack/react-router";
import { FriendsDirectory } from "@/components/Directories";

// Kept alongside /friends because both routes existed in the Next app and
// older shared links may still point here.
export const Route = createFileRoute("/people")({ component: FriendsDirectory });
