import { CustomerPagePlaceholder } from "@/components/customer/customer-page-placeholder";

export default function CustomerNotificationsPage() {
  return (
    <CustomerPagePlaceholder
      title="Notifications"
      description="Booking updates, reminders, loyalty alerts, and offers."
      bullets={[
        "Types: confirmed, reminders, cancelled, reschedule requests",
        "Phone-first preferences (SMS/push), email is optional",
        "Mark as read/unread and remove notifications",
      ]}
    />
  );
}

