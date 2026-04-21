import { CustomerPagePlaceholder } from "@/components/customer/customer-page-placeholder";

export default function CustomerExplorePage() {
  return (
    <CustomerPagePlaceholder
      title="Explore shops"
      description="Browse shops by location, rating, services, and availability."
      bullets={[
        "Filters: distance, rating, price range, available today, services",
        "Sorting: nearest, highest rated, most popular",
        "Cards include photo, rating, open/closed state, and distance",
      ]}
    />
  );
}

