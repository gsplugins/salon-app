import { CustomerPagePlaceholder } from "@/components/customer/customer-page-placeholder";

export default function CustomerReviewsPage() {
  return (
    <CustomerPagePlaceholder
      title="My reviews"
      description="Manage written reviews and pending review requests."
      bullets={[
        "See all reviews written by you",
        "Edit/delete your own review",
        "Pending reviews from completed appointments",
      ]}
    />
  );
}

