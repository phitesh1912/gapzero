import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { Intro } from "@/components/intro/Intro";

export const metadata: Metadata = { title: `${BRAND.name}: refill command center` };

// Every visit starts with the two-page intro walkthrough; it ends at the role picker (/start).
export default function Home() {
  return <Intro />;
}
