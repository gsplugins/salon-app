import { supabaseAdmin } from "./supabase.js";

type DefaultServiceSeed = {
  name: string;
  category: string;
  duration_minutes: number;
  buffer_after_minutes: number;
  price_cents: number;
  description: string;
  sort_order: number;
};

const DEFAULT_SERVICES: DefaultServiceSeed[] = [
  {
    name: "Classic Haircut",
    category: "haircut",
    duration_minutes: 35,
    buffer_after_minutes: 5,
    price_cents: 60000,
    description: "Consultation, precision cut, and finishing style.",
    sort_order: 10
  },
  {
    name: "Skin Fade",
    category: "haircut",
    duration_minutes: 45,
    buffer_after_minutes: 5,
    price_cents: 90000,
    description: "Low/mid/high fade with clipper and detail blending.",
    sort_order: 20
  },
  {
    name: "Beard Trim & Line-up",
    category: "beard",
    duration_minutes: 25,
    buffer_after_minutes: 5,
    price_cents: 50000,
    description: "Shape, neckline cleanup, and razor line definition.",
    sort_order: 30
  },
  {
    name: "Haircut + Beard Combo",
    category: "combo",
    duration_minutes: 60,
    buffer_after_minutes: 10,
    price_cents: 120000,
    description: "Popular full grooming session for regular clients.",
    sort_order: 40
  },
  {
    name: "Kids Haircut",
    category: "haircut",
    duration_minutes: 30,
    buffer_after_minutes: 5,
    price_cents: 45000,
    description: "Comfort-focused cut for children under 12.",
    sort_order: 50
  },
  {
    name: "Hair Wash & Styling",
    category: "grooming",
    duration_minutes: 20,
    buffer_after_minutes: 5,
    price_cents: 35000,
    description: "Quick refresh wash and styling before events.",
    sort_order: 60
  }
];

export async function seedDefaultServicesForShop(shopId: number): Promise<void> {
  const existing = await supabaseAdmin
    .from("salon_services")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .limit(1);
  if ((existing.count ?? 0) > 0) return;

  const payload = DEFAULT_SERVICES.map((s) => ({
    shop_id: shopId,
    name: s.name,
    category: s.category,
    description: s.description,
    duration_minutes: s.duration_minutes,
    buffer_after_minutes: s.buffer_after_minutes,
    price_cents: s.price_cents,
    is_active: true,
    online_bookable: true,
    sort_order: s.sort_order
  }));

  await supabaseAdmin.from("salon_services").insert(payload);
}
