import { redirect } from "next/navigation";

/** La raíz lleva al Panel de control (el proxy exige sesión antes). */
export default function Home() {
  redirect("/panel");
}
