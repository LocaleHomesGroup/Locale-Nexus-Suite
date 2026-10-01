import type { Metadata } from "next";
import { NotificationsScreen } from "@/components/modules/notifications/NotificationsScreen";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
