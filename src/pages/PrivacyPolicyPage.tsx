import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useLanguage } from "@/contexts/LanguageContext";

const PrivacyPolicyPage = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <SiteHeader />
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          {t("Privacy Policy", "गोपनीयता नीति")}
        </h1>
        <div className="prose prose-sm md:prose-base max-w-none text-foreground/80 space-y-6">
          <p className="text-muted-foreground text-sm">{t("Last updated: April 1, 2026", "अंतिम अपडेट: 1 अप्रैल, 2026")}</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("1. Information We Collect", "1. हम कौन सी जानकारी एकत्र करते हैं")}</h2>
            <p>{t(
              "We collect personal information that you voluntarily provide to us when you register on the website, place an order, subscribe to our newsletter, or contact us. This includes your name, email address, phone number, shipping address, and payment information.",
              "जब आप वेबसाइट पर रजिस्टर करते हैं, ऑर्डर देते हैं, न्यूज़लेटर की सदस्यता लेते हैं, या हमसे संपर्क करते हैं, तो हम आपकी व्यक्तिगत जानकारी एकत्र करते हैं। इसमें आपका नाम, ईमेल पता, फोन नंबर, शिपिंग पता और भुगतान जानकारी शामिल है।"
            )}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("2. How We Use Your Information", "2. हम आपकी जानकारी का उपयोग कैसे करते हैं")}</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("To process and fulfill your orders", "आपके ऑर्डर को प्रोसेस और पूरा करने के लिए")}</li>
              <li>{t("To send order confirmations and tracking updates", "ऑर्डर की पुष्टि और ट्रैकिंग अपडेट भेजने के लिए")}</li>
              <li>{t("To improve our website and services", "हमारी वेबसाइट और सेवाओं को बेहतर बनाने के लिए")}</li>
              <li>{t("To send promotional communications (with your consent)", "प्रचार संचार भेजने के लिए (आपकी सहमति से)")}</li>
              <li>{t("To respond to customer service requests", "ग्राहक सेवा अनुरोधों का जवाब देने के लिए")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("3. Data Security", "3. डेटा सुरक्षा")}</h2>
            <p>{t(
              "We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All payment transactions are processed through secure, encrypted channels.",
              "हम आपकी व्यक्तिगत जानकारी को अनधिकृत पहुँच, परिवर्तन, प्रकटीकरण या विनाश से बचाने के लिए उचित सुरक्षा उपाय लागू करते हैं। सभी भुगतान लेनदेन सुरक्षित, एन्क्रिप्टेड चैनलों के माध्यम से संसाधित किए जाते हैं।"
            )}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("4. Cookies", "4. कुकीज़")}</h2>
            <p>{t(
              "We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. You can control cookie preferences through your browser settings.",
              "हम आपके ब्राउज़िंग अनुभव को बेहतर बनाने, साइट ट्रैफ़िक का विश्लेषण करने और सामग्री को व्यक्तिगत बनाने के लिए कुकीज़ का उपयोग करते हैं। आप अपनी ब्राउज़र सेटिंग्स के माध्यम से कुकी प्राथमिकताओं को नियंत्रित कर सकते हैं।"
            )}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("5. Third-Party Sharing", "5. तृतीय-पक्ष साझाकरण")}</h2>
            <p>{t(
              "We do not sell, trade, or rent your personal information to third parties. We may share data with trusted service providers who assist us in operating our website, conducting business, or servicing you, as long as they agree to keep this information confidential.",
              "हम आपकी व्यक्तिगत जानकारी को तीसरे पक्ष को बेचते, व्यापार या किराए पर नहीं देते हैं। हम उन विश्वसनीय सेवा प्रदाताओं के साथ डेटा साझा कर सकते हैं जो हमारी वेबसाइट संचालित करने, व्यवसाय चलाने या आपकी सेवा करने में सहायता करते हैं।"
            )}</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t("6. Contact Us", "6. हमसे संपर्क करें")}</h2>
            <p>{t(
              "If you have any questions about this Privacy Policy, please contact us at support@vedicupchar.com or call us at +91-XXXXXXXXXX.",
              "यदि इस गोपनीयता नीति के बारे में कोई प्रश्न हैं, तो कृपया support@vedicupchar.com पर ईमेल करें या +91-XXXXXXXXXX पर कॉल करें।"
            )}</p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default PrivacyPolicyPage;
