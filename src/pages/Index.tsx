import AnnouncementBar from "@/components/AnnouncementBar";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import HeroBanner from "@/components/HeroBanner";
import TrustBadges from "@/components/TrustBadges";
import ConcernProducts from "@/components/ConcernProducts";
import FeaturedProducts from "@/components/FeaturedProducts";
import TopSellingProducts from "@/components/TopSellingProducts";
import ConsultationBanner from "@/components/ConsultationBanner";
import CountdownSale from "@/components/CountdownSale";
import HomeBlogSection from "@/components/HomeBlogSection";
import MediaLogos from "@/components/MediaLogos";
import ImpactStats from "@/components/ImpactStats";
import Testimonials from "@/components/Testimonials";
import SiteFooter from "@/components/SiteFooter";
import ConsultationPopup from "@/components/ConsultationPopup";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const Index = () => {
  usePageMeta(
    "VedicUpchar | Authentic Ayurvedic Healthcare",
    "Authentic Ayurvedic medicines, herbal wellness products and free doctor consultation from VedicUpchar."
  );

  const isFetching = useIsFetching();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Reveal the whole page at once when initial data has loaded (with a safety timeout)
    if (isFetching === 0) {
      setReady(true);
      return;
    }
    const t = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(t);
  }, [isFetching]);

  return (
    <div className="min-h-screen bg-background">
      {!ready && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div style={{ visibility: ready ? "visible" : "hidden" }}>
        <ConsultationPopup />
        <TopBar />
        <SiteHeader />
        <main>
          <CountdownSale />
          <HeroBanner />
          <ConcernProducts />
          <TopSellingProducts />
          <FeaturedProducts />
          <Testimonials />
          <ImpactStats />
          <MediaLogos />
          <HomeBlogSection />
          <TrustBadges />
          <ConsultationBanner />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
};

export default Index;
