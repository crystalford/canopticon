import { redirect } from "next/navigation";

export const runtime = "edge";

export default function Redirect() {
  redirect("/p/theses");
}
