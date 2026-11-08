import { redirect } from "next/navigation";

export default function LookupRedirectPage() {
  redirect("/orders/lookup");
}
