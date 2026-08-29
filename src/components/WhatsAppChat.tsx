import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const WhatsAppChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();
  const whatsappNumber = "919999999999"; // Replace with actual number

  const quickMessages = [
    { label: t("Order Status", "ऑर्डर स्टेटस"), msg: "Hi, I want to check my order status." },
    { label: t("Product Info", "उत्पाद जानकारी"), msg: "Hi, I need information about a product." },
    { label: t("Return/Refund", "रिटर्न/रिफंड"), msg: "Hi, I want to request a return or refund." },
    { label: t("Talk to Expert", "विशेषज्ञ से बात करें"), msg: "Hi, I want to consult an Ayurvedic expert." },
  ];

  const openWhatsApp = (message: string) => {
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-20 md:bottom-5 right-4 md:right-5 z-50">
      {isOpen && (
        <div className="mb-3 bg-card border border-border rounded-2xl shadow-2xl w-72 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-primary p-4 flex items-center justify-between">
            <div>
              <p className="text-primary-foreground font-semibold text-sm">VedicUpchar</p>
              <p className="text-primary-foreground/80 text-xs">{t("Typically replies instantly", "आमतौर पर तुरंत जवाब देता है")}</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-primary-foreground/80 hover:text-primary-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-3">{t("Choose a topic to start chatting:", "चैट शुरू करने के लिए विषय चुनें:")}</p>
            {quickMessages.map((q, i) => (
              <button
                key={i}
                onClick={() => openWhatsApp(q.msg)}
                className="w-full text-left px-3 py-2.5 bg-secondary/50 hover:bg-secondary rounded-xl text-sm text-foreground font-medium transition"
              >
                {q.label}
              </button>
            ))}
            <button
              onClick={() => openWhatsApp("Hi, I have a question.")}
              className="w-full mt-2 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              {t("Start Chat", "चैट शुरू करें")}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        aria-label="WhatsApp Chat"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default WhatsAppChat;
