import { CustomerPagePlaceholder } from "@/components/customer/customer-page-placeholder";

export default function CustomerPaymentsPage() {
  return (
    <CustomerPagePlaceholder
      title="Payments"
      description="Track payment history and saved payment methods."
      bullets={[
        "Filter by date, shop, and status",
        "Transaction details and receipt download",
        "Manage saved card/mobile payment methods",
      ]}
    />
  );
}

