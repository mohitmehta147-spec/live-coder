import { createFileRoute } from "@tanstack/react-router";
import BookingSuccessPage from "@/pages/BookingSuccessPage";

export const Route = createFileRoute("/booking-success")({
  component: BookingSuccessPage,
  head: () => ({
    meta: [
      { title: "Booking Confirmed - VedicUpchar" },
      { name: "description", content: "Your consultation booking is confirmed." },
      { property: "og:title", content: "Booking Confirmed - VedicUpchar" },
      { property: "og:description", content: "Your consultation booking is confirmed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
