import { redirect } from "next/navigation";

/** Default public booking uses the demo shop slug; each barber shop has its own URL `/s/{slug}/book`. */
export default function BookPage() {
  redirect("/s/demo/book");
}
