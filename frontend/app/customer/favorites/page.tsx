import { CustomerPagePlaceholder } from "@/components/customer/customer-page-placeholder";

export default function CustomerFavoritesPage() {
  return (
    <CustomerPagePlaceholder
      title="Favorites"
      description="Quick access to your favorited barbershops."
      bullets={[
        "List favorite shops with open/closed status",
        "Quick book action from each favorite",
        "Remove shop from favorites",
      ]}
    />
  );
}

