import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE } from "@/lib/cookies";

export default async function RootPage() {
  const cookieStore = await cookies();
  const hasToken = !!cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  redirect(hasToken ? "/dashboard" : "/login");
}
