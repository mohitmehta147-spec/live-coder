import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useLanguage } from "@/contexts/LanguageContext";

const TermsPage = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <SiteHeader />
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          {t("Terms & Conditions", "नियम और शर्तें")}
        </h1>
        <div className="prose prose-sm md:prose-base max-w-none text-foreground/80 space-y-6">
          <p className="text-muted-foreground text-sm">{t("Last updated: April 1, 2026", "अंतिम अपडेट: 1 अप्रैल, 2026")}</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("1. General", "1. सामान्य")}</h2>
            <p>{t(
              "By accessing and using VedicUpchar website and services, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our website.",
              "VedicUpchar वेबसाइट और सेवाओं का उपयोग करके, आप इन नियमों और शर्तों से बंधे होने के लिए सहमत होते हैं। यदि आप इन शर्तों से सहमत नहीं हैं, तो कृपया हमारी वेबसाइट का उपयोग न करें।"
            )}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("2. Products & Pricing", "2. उत्पाद और मूल्य निर्धारण")}</h2>
            <p>{t(
              "All products listed on VedicUpchar are Ayurvedic and herbal products. Prices are listed in Indian Rupees (₹) and are subject to change without prior notice. We strive to provide accurate product information, but we do not warrant that product descriptions or pricing are error-free.",
              "VedicUpchar पर सूचीबद्ध सभी उत्पाद आयुर्वेदिक और हर्बल उत्पाद हैं। कीमतें भारतीय रुपये (₹) में सूचीबद्ध हैं और बिना पूर्व सूचना के परिवर्तन के अधीन हैं।"
            )}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("3. Orders & Payment", "3. ऑर्डर और भुगतान")}</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("Orders are confirmed only after successful payment", "ऑर्डर केवल सफल भुगतान के बाद ही पुष्टि होते हैं")}</li>
              <li>{t("We accept UPI, credit/debit cards, net banking, and COD", "हम UPI, क्रेडिट/डेबिट कार्ड, नेट बैंकिंग और COD स्वीकार करते हैं")}</li>
              <li>{t("We reserve the right to cancel any order for any reason", "हम किसी भी कारण से किसी भी ऑर्डर को रद्द करने का अधिकार सुरक्षित रखते हैं")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("4. Shipping & Delivery", "4. शिपिंग और डिलीवरी")}</h2>
            <p>{t(
              "We aim to deliver orders within 5-7 business days across India. Delivery times may vary based on location and availability. Shipping charges, if applicable, will be displayed at checkout.",
              "हम पूरे भारत में 5-7 कार्य दिवसों के भीतर ऑर्डर डिलीवर करने का लक्ष्य रखते हैं। डिलीवरी का समय स्थान और उपलब्धता के आधार पर भिन्न हो सकता है।"
            )}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("5. Returns & Refunds", "5. रिटर्न और रिफंड")}</h2>
            <p>{t(
              "We accept returns within 7 days of delivery for unopened products in original packaging. Refunds will be processed within 7-10 business days after receiving the returned product. For damaged or defective products, please contact us within 48 hours of delivery.",
              "हम डिलीवरी के 7 दिनों के भीतर मूल पैकेजिंग में अनखुले उत्पादों के लिए रिटर्न स्वीकार करते हैं। रिफंड लौटाए गए उत्पाद प्राप्त होने के 7-10 कार्य दिवसों में संसाधित किया जाएगा।"
            )}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("6. Disclaimer", "6. अस्वीकरण")}</h2>
            <p>{t(
              "Our Ayurvedic products are not intended to diagnose, treat, cure, or prevent any disease. Results may vary from person to person. Please consult a healthcare professional before starting any new supplement.",
              "हमारे आयुर्वेदिक उत्पाद किसी भी बीमारी के निदान, उपचार, इलाज या रोकथाम के लिए नहीं हैं। परिणाम व्यक्ति-व्यक्ति में भिन्न हो सकते हैं। कृपया कोई नया सप्लीमेंट शुरू करने से पहले स्वास्थ्य विशेषज्ञ से परामर्श करें।"
            )}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("7. Contact", "7. संपर्क")}</h2>
            <p>{t(
              "For any queries regarding these Terms & Conditions, reach us at support@vedicupchar.com.",
              "इन नियमों और शर्तों के बारे में किसी भी प्रश्न के लिए, support@vedicupchar.com पर संपर्क करें।"
            )}</p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default TermsPage;
