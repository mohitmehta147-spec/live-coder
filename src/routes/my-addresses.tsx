import { createFileRoute } from "@tanstack/react-router";
import MyAddressesPage from "@/pages/MyAddressesPage";

export const Route = createFileRoute("/my-addresses")({
  component: MyAddressesPage,
  head: () => ({
    meta: [
      { title: "My Addresses - VedicUpchar" },
      { name: "description", content: "Manage your VedicUpchar delivery addresses." },
      { property: "og:title", content: "My Addresses - VedicUpchar" },
      { property: "og:description", content: "Manage your VedicUpchar delivery addresses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
