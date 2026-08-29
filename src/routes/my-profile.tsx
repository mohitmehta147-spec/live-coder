import { createFileRoute } from "@tanstack/react-router";
import MyProfilePage from "@/pages/MyProfilePage";

export const Route = createFileRoute("/my-profile")({
  component: MyProfilePage,
  head: () => ({
    meta: [
      { title: "My Profile - VedicUpchar" },
      { name: "description", content: "Manage your VedicUpchar profile." },
      { property: "og:title", content: "My Profile - VedicUpchar" },
      { property: "og:description", content: "Manage your VedicUpchar profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
