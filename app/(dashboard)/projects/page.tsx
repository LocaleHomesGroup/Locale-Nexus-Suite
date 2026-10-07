import { permanentRedirect } from "next/navigation";

/**
 * The Projects dashboard moved into Tickets: each project is a group of
 * tickets now, and its progress comes from them. Old links land there.
 */
export default function Page() {
  permanentRedirect("/tickets?tab=projects");
}
