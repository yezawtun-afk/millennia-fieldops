import { redirect } from "next/navigation";

// The root simply sends people to the dashboard (middleware bounces
// signed-out visitors to /login).
export default function Home() {
  redirect("/dashboard");
}
