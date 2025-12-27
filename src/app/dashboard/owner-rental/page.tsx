import { redirect } from "next/navigation";

export default function OwnerRentalRedirect() {
  redirect("/dashboard/owner-rentals");
}
