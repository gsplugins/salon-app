import { CustomerPagePlaceholder } from "@/components/customer/customer-page-placeholder";

export default async function CustomerBookingDetailsPage(props: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await props.params;
  return (
    <CustomerPagePlaceholder
      title={`Appointment #${appointmentId}`}
      description="Detailed booking view with shop/service/staff/payment info."
      bullets={[
        "Map directions and calendar add",
        "Payment method and status",
        "Check-in QR and notes (optional)",
      ]}
    />
  );
}

