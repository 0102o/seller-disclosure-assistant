import type { Metadata } from "next";
import { ReviewView } from "@/components/ReviewView";

export const metadata: Metadata = { title: "Review your answers" };

export default function ReviewPage() {
  return <ReviewView />;
}
