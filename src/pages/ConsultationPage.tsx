import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Phone, Clock, Users, Award, CheckCircle2, Stethoscope, ChevronLeft, ChevronRight, Upload, X, Sparkles, Shield, HeartPulse, History } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useToast } from "@/hooks/use-toast";
import { notifyAdmin } from "@/lib/notify-admin";
import CountUp from "@/components/CountUp";
const anilBansalAsset = { url: "/doctor-anil-bansal.png" };
import { defaultConsultationTypes, DEFAULT_SPECIAL, type ConsultationType, type SpecialConfig } from "@/components/admin/AdminConsultationTypes";

const buildSpecialType = (s: SpecialConfig): ConsultationType => ({
  name: `${s.name} — ${s.subtitle}`,
  nameHi: `${s.nameHi} — ${s.subtitleHi}`,
  price: s['price'], mrp: s['mrp'], duration: s.duration, icon: "🧘",
  description: s.tagline, descriptionHi: s.taglineHi,
});

const CONSULTATION_MODES = [
  { key: "video_call", label: "Video Call", labelHi: "वीडियो कॉल", icon: "📹" },
  { key: "voice_call", label: "Voice Call", labelHi: "वॉइस कॉल", icon: "📞" },
  { key: "appointment", label: "Appointment", labelHi: "अपॉइंटमेंट", icon: "🏥" },
];

const DEFAULT_TIME_SLOTS = [
  "11:00 AM", "11:15 AM", "11:30 AM", "11:45 AM",
  "12:00 PM", "12:15 PM", "12:30 PM", "12:45 PM",
  "2:00 PM", "2:15 PM", "2:30 PM", "2:45 PM",
  "3:00 PM", "3:15 PM", "3:30 PM", "3:45 PM",
  "4:00 PM", "4:15 PM", "4:30 PM", "4:45 PM",
  "5:00 PM", "5:15 PM", "5:30 PM", "5:45 PM",
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const parseTimeSlot = (time: string, date: Date): Date => {
  const [timePart, ampm] = time.split(" ");
  let [hours, minutes] = timePart.split(":").map(Number);
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
};


const INDIAN_CITIES = [
  // Metros & Tier-1
  "Mumbai","Delhi","New Delhi","Bangalore","Bengaluru","Hyderabad","Ahmedabad","Chennai","Kolkata","Pune","Jaipur","Surat","Lucknow","Kanpur","Nagpur","Indore","Thane","Bhopal","Visakhapatnam","Patna","Vadodara","Ghaziabad","Ludhiana","Agra","Nashik","Faridabad","Meerut","Rajkot","Varanasi","Srinagar","Chandigarh","Guwahati","Coimbatore","Kochi","Dehradun","Noida","Greater Noida","Gurgaon","Gurugram",
  // Tier-2
  "Amritsar","Navi Mumbai","Prayagraj","Allahabad","Ranchi","Howrah","Jabalpur","Gwalior","Vijayawada","Jodhpur","Madurai","Raipur","Kota","Solapur","Hubli-Dharwad","Hubli","Mysore","Mysuru","Tiruchirappalli","Trichy","Bareilly","Aligarh","Tiruppur","Moradabad","Jalandhar","Bhubaneswar","Salem","Warangal","Guntur","Bhiwandi","Saharanpur","Gorakhpur","Bikaner","Amravati","Jamshedpur","Bhilai","Cuttack","Firozabad","Nellore","Bhavnagar","Durgapur","Asansol","Rourkela","Nanded","Kolhapur","Ajmer","Akola","Gulbarga","Kalaburagi","Jamnagar","Ujjain","Loni","Siliguri","Jhansi","Ulhasnagar","Jammu","Sangli","Mangalore","Mangaluru","Erode","Belgaum","Belagavi","Tirunelveli","Malegaon","Gaya","Jalgaon","Udaipur","Kozhikode","Calicut","Kurnool","Bokaro","Rajahmundry","Ballari","Bellary","Agartala","Bhagalpur","Latur","Dhule","Korba","Bhilwara","Brahmapur","Berhampur","Muzaffarpur","Ahmednagar","Mathura","Kollam","Kadapa","Anantapur","Bilaspur","Sambalpur","Shahjahanpur","Satara","Bijapur","Vijayapura","Rampur","Shimoga","Shivamogga","Chandrapur","Junagadh","Thrissur","Alwar","Bardhaman","Burdwan","Kulti","Kakinada","Nizamabad","Parbhani","Tumkur","Tumakuru","Khammam","Bihar Sharif","Panipat","Darbhanga","Bally","Dewas","Ichalkaranji","Karnal","Bathinda","Jalna","Eluru","Barasat","Purnia","Satna","Mau","Sonipat","Farrukhabad","Durg","Imphal","Ratlam","Hapur","Arrah","Karimnagar","Etawah","Ambarnath",
  // State Capitals & UTs
  "Pondicherry","Puducherry","Shillong","Gangtok","Shimla","Itanagar","Kohima","Dispur","Port Blair","Panaji","Daman","Silvassa","Kavaratti","Aizawl","Bhopal","Raipur","Ranchi","Gandhinagar","Thiruvananthapuram","Trivandrum",
  // Tier-3 & Districts
  "Faridkot","Hoshiarpur","Pathankot","Phagwara","Moga","Kapurthala","Muktsar","Barnala","Mansa","Sangrur","Patiala","Mohali","Ropar","Rupnagar","Nawanshahr","Fazilka","Ferozepur","Firozpur","Tarn Taran","Gurdaspur",
  "Ambala","Yamunanagar","Kurukshetra","Kaithal","Jind","Hisar","Sirsa","Bhiwani","Rohtak","Rewari","Mahendragarh","Palwal","Nuh","Fatehabad","Panchkula","Jhajjar",
  "Muzaffarnagar","Bulandshahr","Sambhal","Amroha","Budaun","Pilibhit","Lakhimpur Kheri","Sitapur","Hardoi","Unnao","Rae Bareli","Sultanpur","Faizabad","Ayodhya","Ambedkar Nagar","Azamgarh","Ballia","Deoria","Basti","Gonda","Bahraich","Shravasti","Balrampur","Siddharthnagar","Kushinagar","Maharajganj","Sant Kabir Nagar","Jaunpur","Pratapgarh","Fatehpur","Hamirpur","Mahoba","Banda","Chitrakoot","Lalitpur","Mirzapur","Sonbhadra","Chandauli","Bhadohi","Mainpuri","Firozabad","Kasganj","Hathras","Auraiya","Kannauj","Etah",
  "Bhagalpur","Begusarai","Munger","Samastipur","Hajipur","Chhapra","Siwan","Gopalganj","Motihari","Bettiah","Sasaram","Buxar","Ara","Aurangabad","Nawada","Jehanabad","Arwal","Sheikhpura","Lakhisarai","Jamui","Khagaria","Madhepura","Saharsa","Supaul","Kishanganj","Katihar","Madhubani","Sitamarhi",
  "Hazaribagh","Dhanbad","Giridih","Deoghar","Dumka","Pakur","Godda","Sahebganj","Ramgarh","Bokaro","Chatra","Koderma","Latehar","Lohardaga","Gumla","Simdega","Khunti","Palamu","Garhwa","West Singhbhum","Chaibasa","East Singhbhum","Seraikela",
  "Hooghly","Chinsurah","Midnapore","Kharagpur","Haldia","Bankura","Purulia","Malda","Raiganj","Balurghat","Jalpaiguri","Cooch Behar","Alipurduar","Darjeeling","Kalimpong","Krishnanagar","Baharampur","Jangipur","Basirhat","Diamond Harbour","Tamluk","Contai","Jhargram","Bolpur","Shantiniketan","Suri","Rampurhat",
  "Raigarh","Durg","Rajnandgaon","Jagdalpur","Ambikapur","Kawardha","Dhamtari","Mahasamund","Kanker",
  "Chhindwara","Sagar","Rewa","Satna","Shahdol","Damoh","Tikamgarh","Panna","Chhatarpur","Datia","Shivpuri","Guna","Ashok Nagar","Vidisha","Raisen","Sehore","Hoshangabad","Betul","Khandwa","Khargone","Burhanpur","Barwani","Dhar","Jhabua","Alirajpur","Mandla","Seoni","Balaghat","Narsinghpur","Morena","Bhind","Sheopur","Neemuch","Mandsaur",
  "Jalore","Sirohi","Barmer","Jaisalmer","Pali","Nagaur","Sikar","Jhunjhunu","Churu","Hanumangarh","Sri Ganganagar","Tonk","Bundi","Bhilwara","Chittorgarh","Rajsamand","Dungarpur","Banswara","Pratapgarh","Sawai Madhopur","Karauli","Dholpur","Baran","Jhalawar","Dausa","Bharatpur","Deeg",
  "Anand","Nadiad","Mehsana","Palanpur","Bharuch","Navsari","Valsad","Vapi","Gandhidham","Morbi","Surendranagar","Amreli","Botad","Porbandar","Veraval","Junagadh","Dwarka","Kutch","Bhuj","Dahod","Godhra","Panchmahal",
  "Nashik","Aurangabad","Chhatrapati Sambhajinagar","Latur","Osmanabad","Dharashiv","Beed","Hingoli","Nanded","Parbhani","Jalna","Buldhana","Washim","Yavatmal","Wardha","Gondia","Bhandara","Gadchiroli","Ratnagiri","Sindhudurg","Satara","Sangli","Miraj","Karad","Baramati","Shirdi","Pandharpur","Ichalkaranji",
  "Dharwad","Gadag","Haveri","Raichur","Koppal","Yadgir","Bidar","Chitradurga","Davanagere","Hassan","Mandya","Chamarajanagar","Kodagu","Madikeri","Udupi","Chikmagalur","Chikkaballapur","Kolar","Ramanagara","Bagalkot","Uttara Kannada","Karwar",
  "Thrissur","Palakkad","Malappuram","Kannur","Kasaragod","Wayanad","Idukki","Kottayam","Alappuzha","Pathanamthitta",
  "Tirunelveli","Thoothukudi","Tuticorin","Nagercoil","Kanyakumari","Thanjavur","Kumbakonam","Dindigul","Theni","Virudhunagar","Sivakasi","Ramanathapuram","Sivaganga","Karur","Namakkal","Dharmapuri","Krishnagiri","Vellore","Ranipet","Tiruvannamalai","Villupuram","Cuddalore","Ariyalur","Perambalur","Nagapattinam","Tiruvarur","Mayiladuthurai","Pudukkottai","Nilgiris","Ooty","Hosur","Kancheepuram",
  "Srikakulam","Vizianagaram","East Godavari","Kakinada","West Godavari","Eluru","Krishna","Machilipatnam","Prakasam","Ongole","Nellore","Chittoor","Tirupati","Kadapa","Kurnool","Anantapur",
  "Medak","Sangareddy","Siddipet","Nalgonda","Suryapet","Mahabubabad","Mancherial","Adilabad","Nirmal","Jagtial","Rajanna Sircilla","Kamareddy","Medchal","Wanaparthy","Nagarkurnool","Jogulamba Gadwal",
  "Baripada","Balasore","Bhadrak","Jajpur","Kendrapara","Jagatsinghpur","Puri","Konark","Nayagarh","Ganjam","Berhampur","Koraput","Rayagada","Nabarangpur","Malkangiri","Kalahandi","Bhawanipatna","Nuapada","Bolangir","Sonepur","Bargarh","Jharsuguda","Sundargarh","Deogarh","Angul","Dhenkanal","Keonjhar",
  "Dibrugarh","Jorhat","Tezpur","Nagaon","Tinsukia","Silchar","Karimganj","Hailakandi","Barpeta","Nalbari","Goalpara","Kokrajhar","Dhubri","Bongaigaon",
  "Dimapur","Mon","Wokha","Zunheboto","Tuensang","Mokokchung","Phek","Longleng","Peren","Kiphire",
  "Lunglei","Champhai","Serchhip","Kolasib","Lawngtlai","Mamit","Saiha","Hnahthial",
  "Tura","Jowai","Nongpoh","Williamnagar","Baghmara","Nongstoin","Resubelpara","Khliehriat",
  "Churachandpur","Thoubal","Bishnupur","Ukhrul","Senapati","Chandel","Tamenglong","Jiribam","Kangpokpi","Tengnoupal","Pherzawl","Noney","Kakching","Kamjong",
  "Tawang","Bomdila","Ziro","Along","Pasighat","Tezu","Namsai","Changlang","Khonsa","Yingkiong","Daporijo","Roing","Anini","Seppa",
  "Namchi","Mangan","Gyalshing","Soreng","Pakyong",
  // Jammu & Kashmir / Ladakh
  "Anantnag","Baramulla","Sopore","Kupwara","Pulwama","Shopian","Kulgam","Budgam","Bandipora","Ganderbal","Udhampur","Kathua","Doda","Kishtwar","Ramban","Reasi","Rajouri","Poonch","Samba","Leh","Kargil",
  // Uttarakhand
  "Haridwar","Rishikesh","Roorkee","Haldwani","Kashipur","Rudrapur","Nainital","Almora","Pithoragarh","Champawat","Bageshwar","Uttarkashi","Tehri","Pauri","Chamoli","Gopeshwar","Srinagar Garhwal","Kotdwar","Lansdowne",
  // Himachal Pradesh
  "Manali","Kullu","Mandi","Bilaspur","Una","Hamirpur","Kangra","Dharamsala","Palampur","Chamba","Dalhousie","Solan","Nahan","Rampur Bushahr","Keylong",
  // Goa
  "Margao","Vasco da Gama","Mapusa","Ponda","Bicholim","Curchorem","Sanquelim","Canacona","Quepem","Sanguem","Pernem",
  // Chhattisgarh additional
  "Bilaspur","Korba","Janjgir","Mungeli","Surajpur","Balrampur","Surguja",
  // Tripura
  "Agartala","Udaipur","Dharmanagar","Kailashahar","Ambassa","Belonia","Sabroom","Khowai","Bishramganj",
  // Andaman & Nicobar
  "Car Nicobar","Campbell Bay","Mayabunder","Diglipur","Rangat",
  // Dadra & Nagar Haveli / Daman & Diu
  "Diu",
].sort();

const CitySearchInput = ({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: (en: string, hi: string) => string }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const filtered = INDIAN_CITIES.filter(c => c.toLowerCase().includes(search.toLowerCase())).slice(0, 20);

  return (
    <div className="relative">
      <input
        value={search}
        onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={t("Search City", "शहर खोजें")}
        className="w-full px-4 py-3.5 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background transition-all"
      />
      {open && search && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(city => (
            <button key={city} type="button"
              onClick={() => { setSearch(city); onChange(city); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 hover:text-primary transition">
              {city}
            </button>
          ))}
        </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
};

const ConsultationPage = () => {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<"select" | "date" | "time" | "details">("select");

  // Keep the page at the top when moving between booking steps (mobile fix)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [step]);
  const [consultationMode, setConsultationMode] = useState(CONSULTATION_MODES[0]);
  const [consultationTypes, setConsultationTypes] = useState<ConsultationType[]>(defaultConsultationTypes);
  const [selectedType, setSelectedType] = useState<ConsultationType>(defaultConsultationTypes[0]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({ patient_name: "", mobile: "", city: "", disease: "", gender: "", age: "", prescription_note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, url: string}[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [session, setSession] = useState<any>(null);
  const [myConsultations, setMyConsultations] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [allSlots, setAllSlots] = useState<string[]>(DEFAULT_TIME_SLOTS);
  const [fullSlots, setFullSlots] = useState<string[]>([]);
  const [special, setSpecial] = useState<SpecialConfig>(DEFAULT_SPECIAL);
  const [paymentMode, setPaymentMode] = useState<"prepaid" | "postpaid">("postpaid");
  const isSpecialSelected = special.active && selectedType.name === buildSpecialType(special).name;
  // OTP gate for guest submissions
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("key, value")
        .in("key", ["consultation_slots", "consultation_full_slots", "consultation_types", "anil_bansal_special"]);
      const m: Record<string, string> = {};
      (data || []).forEach((s: any) => { m[s.key] = s.value || ""; });
      try { if (m['consultation_slots']) setAllSlots(JSON.parse(m['consultation_slots'])); } catch {}
      try { if (m['consultation_full_slots']) setFullSlots(JSON.parse(m['consultation_full_slots'])); } catch {}
      try {
        if (m['consultation_types']) {
          const parsed = JSON.parse(m['consultation_types']);
          // Admin panel is the single source of truth; only "active" types show.
          const live = Array.isArray(parsed) ? parsed.filter((t: any) => t && t.active !== false) : [];
          if (live.length) {
            setConsultationTypes(live);
            setSelectedType(live[0]);
          }
        }
      } catch {}
      try {
        if (m['anil_bansal_special']) {
          const p = JSON.parse(m['anil_bansal_special']);
          setSpecial({ ...DEFAULT_SPECIAL, ...p });
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Preload Razorpay checkout script (used for prepaid special consultations)
  useEffect(() => {
    if (document.getElementById("razorpay-sdk")) return;
    const s = document.createElement("script");
    s.id = "razorpay-sdk";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchMyConsultations(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session?.user) fetchMyConsultations(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchMyConsultations = async (userId: string) => {
    const { data } = await supabase.from("consultations").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setMyConsultations(data || []);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [calMonth, calYear]);

  const isDateSelectable = (day: number) => new Date(calYear, calMonth, day) >= today;
  const isSelected = (day: number) => selectedDate?.getDate() === day && selectedDate?.getMonth() === calMonth && selectedDate?.getFullYear() === calYear;

  const availableTimeSlots = useMemo(() => {
    if (!selectedDate) return allSlots;
    const dateKey = selectedDate.toISOString().split("T")[0];
    const notFull = allSlots.filter(s => !fullSlots.includes(`${dateKey}|${s}`));
    const now = new Date();
    const isToday = selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate();
    if (!isToday) return notFull;
    return notFull.filter(slot => parseTimeSlot(slot, now) > now);
  }, [selectedDate, allSlots, fullSlots]);

  const handleSelectType = (ct: typeof consultationTypes[0]) => {
    setSelectedType(ct);
    setForm(prev => ({ ...prev, disease: lang === "hi" ? ct.nameHi : ct.name }));
    // For Anil Bansal (special) + prepaidOnly, force prepaid
    const isSp = special.active && ct.name === buildSpecialType(special).name;
    if (isSp && special.prepaidOnly) setPaymentMode("prepaid"); else setPaymentMode("postpaid");
    setStep("date");
  };

  const handleDateSelect = (day: number) => {
    if (!isDateSelectable(day)) return;
    setSelectedDate(new Date(calYear, calMonth, day));
    setStep("time");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep("details");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.user?.id) {
      toast({ title: t("Please sign in to upload files", "फ़ाइल अपलोड करने के लिए साइन इन करें"), variant: "destructive" });
      return;
    }
    const uid = currentSession.user.id;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: t("Max 20MB allowed", "अधिकतम 20MB") + `: ${file.name}`, variant: "destructive" });
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${uid}/file-${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage.from("consultation-files").upload(fileName, file, { contentType: file.type });
      if (!error) {
        // Bucket is private — store the path; admin will generate signed URLs
        setUploadedFiles(prev => [...prev, { name: file.name, url: `consultation-files/${fileName}` }]);
      } else {
        toast({ title: t("Upload failed", "अपलोड विफल") + `: ${file.name}`, variant: "destructive" });
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submitConsultation = async (payment?: { id: string; order_id: string }) => {
    setSubmitting(true);
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const fileUrls = uploadedFiles.map(f => f.url);
    const paymentTag = payment ? ` [PAID: ${payment.id}]` : "";
    const consultationTypeStr = `${selectedType.name} (${consultationMode.label}) [${paymentMode === "prepaid" ? "PREPAID" : "PAY AFTER"}]${paymentTag}`;
    const { error } = await supabase.from("consultations").insert([{
      patient_name: form.patient_name,
      mobile: form['mobile'],
      city: form.city || null,
      disease: form.disease || null,
      gender: form.gender || null,
      age: form.age || null,
      prescription_note: form.prescription_note || null,
      consultation_type: consultationTypeStr,
      consultation_date: selectedDate?.toISOString().split('T')[0],
      consultation_time: selectedTime,
      file_urls: fileUrls.length > 0 ? fileUrls : null,
      notes: fileUrls.length > 0 ? uploadedFiles.map(f => f.name).join(", ") : null,
      user_id: currentSession?.user?.id ?? null,
      status: payment ? "contacted" : "pending",
    }]);
    setSubmitting(false);
    if (error) {
      toast({ title: t("Error submitting", "सबमिट करने में त्रुटि"), description: error.message, variant: "destructive" });
    } else {
      let attachments: { name: string; url: string }[] = [];
      if (uploadedFiles.length > 0) {
        const paths = uploadedFiles.map(f => f.url.replace(/^consultation-files\//, ""));
        const { data: signed } = await supabase.storage.from("consultation-files").createSignedUrls(paths, 60 * 60 * 24 * 7);
        attachments = uploadedFiles.map((f, i) => ({ name: f.name, url: signed?.[i]?.signedUrl || "" })).filter(a => a.url);
      }
      notifyAdmin({
        formType: "Doctor Consultation Booking",
        fields: {
          patient_name: form.patient_name, mobile: form['mobile'], city: form.city, age: form.age, gender: form.gender,
          disease: form.disease, consultation_type: consultationTypeStr,
          date: selectedDate?.toISOString().split('T')[0] || "", time: selectedTime || "",
          notes: form.prescription_note,
          ...(payment ? { payment_id: payment.id, razorpay_order_id: payment.order_id } : {}),
        },
        attachments,
      });

      const successState = {
        type: `${lang === "hi" ? selectedType.nameHi : selectedType.name} (${lang === "hi" ? consultationMode.labelHi : consultationMode.label})`,
        date: selectedDate ? `${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}` : "",
        time: selectedTime || "",
        mobile: form['mobile'],
        name: form.patient_name,
      };
      setForm({ patient_name: "", mobile: "", city: "", disease: "", gender: "", age: "", prescription_note: "" });
      setUploadedFiles([]);
      setStep("select"); setSelectedDate(null); setSelectedTime(null);
      setOtpVerified(false); setOtpCode(""); setShowOtpModal(false);
      navigate({ to: "/booking-success", state: successState as any });
    }
  };

  const startRazorpayForConsultation = async (): Promise<boolean> => {
    const amount = special['price'];
    const { data: rzpData, error: rzpError } = await supabase.functions.invoke("create-razorpay-order", {
      body: { amount, receipt: `cons_${Date.now()}` },
    });
    if (rzpError || !rzpData?.order_id) {
      toast({
        title: t("Payment initialization failed", "भुगतान शुरू नहीं हो सका"),
        description: rzpError?.message || rzpData?.error || t("Please try again or contact support", "कृपया पुनः प्रयास करें"),
        variant: "destructive",
      });
      return false;
    }
    if (!(window as any).Razorpay) {
      toast({ title: t("Payment gateway not ready. Please refresh.", "पेमेंट गेटवे तैयार नहीं। रीफ्रेश करें।"), variant: "destructive" });
      return false;
    }
    return new Promise<boolean>((resolve) => {
      const options = {
        key: rzpData.key_id,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: t("VedicUpchar", "वैदिक उपचार"),
        description: t("Consultation Payment", "परामर्श भुगतान"),
        order_id: rzpData.order_id,
        prefill: { name: form.patient_name, contact: form['mobile'] },
        theme: { color: "#16a34a" },
        handler: async (response: any) => {
          const { data: verifyData } = await supabase.functions.invoke("verify-razorpay-payment", {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
          });
          if (!verifyData?.verified) {
            toast({ title: t("Payment verification failed", "भुगतान सत्यापन विफल"), variant: "destructive" });
            resolve(false);
            return;
          }
          await submitConsultation({ id: response.razorpay_payment_id, order_id: response.razorpay_order_id });
          resolve(true);
        },
        modal: {
          ondismiss: () => {
            toast({ title: t("Payment cancelled", "भुगतान रद्द") });
            resolve(false);
          },
        },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_name || !form['mobile']) {
      toast({ title: t("Please fill required fields", "कृपया आवश्यक फ़ील्ड भरें"), variant: "destructive" });
      return;
    }
    const cleanMobile = form['mobile'].replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      toast({ title: t("Enter valid 10-digit mobile number", "वैध 10 अंकों का मोबाइल नंबर दर्ज करें"), variant: "destructive" });
      return;
    }

    // OTP required for everyone (logged-in or guest)

    // Guest: require OTP verification
    if (!otpVerified) {
      setOtpSending(true);
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: cleanMobile, purpose: "consultation" },
      });
      setOtpSending(false);
      if (error || data?.error) {
        toast({ title: t("Failed to send OTP", "OTP भेजने में विफल"), description: data?.error || error?.message, variant: "destructive" });
        return;
      }
      setShowOtpModal(true);
      setOtpCountdown(60);
      toast({ title: t("OTP sent to your mobile!", "OTP आपके मोबाइल पर भेजा गया!") });
      return;
    }

    if (isSpecialSelected && special.prepaidOnly) {
      await startRazorpayForConsultation();
      return;
    }
    await submitConsultation();
  };

  const handleVerifyConsultationOtp = async () => {
    if (otpCode.length !== 6) {
      toast({ title: t("Enter 6-digit OTP", "6 अंकों का OTP दर्ज करें"), variant: "destructive" });
      return;
    }
    const cleanMobile = form['mobile'].replace(/\D/g, '').slice(-10);
    setOtpSending(true);
    const { data, error } = await supabase.functions.invoke("verify-otp", {
      body: { phone: cleanMobile, otp: otpCode, purpose: "consultation", verify_only: true },
    });
    setOtpSending(false);
    if (error || data?.error) {
      toast({ title: t("Invalid OTP", "अमान्य OTP"), description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    setOtpVerified(true);
    setShowOtpModal(false);
    if (isSpecialSelected && special.prepaidOnly) {
      await startRazorpayForConsultation();
      return;
    }
    await submitConsultation();
  };

  const handleResendConsultationOtp = async () => {
    const cleanMobile = form['mobile'].replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) return;
    setOtpSending(true);
    const { data, error } = await supabase.functions.invoke("send-otp", {
      body: { phone: cleanMobile, purpose: "consultation" },
    });
    setOtpSending(false);
    if (error || data?.error) {
      toast({ title: t("Failed to resend OTP", "OTP दोबारा भेजने में विफल"), variant: "destructive" });
      return;
    }
    setOtpCountdown(60);
    toast({ title: t("OTP resent!", "OTP दोबारा भेजा गया!") });
  };

  const formattedDate = selectedDate ? `${MONTHS[selectedDate.getMonth()].slice(0, 3)} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}` : "";
  const stepNumber = step === "select" ? 1 : step === "date" ? 2 : step === "time" ? 3 : 4;

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <SiteHeader />

      {/* Premium Hero removed per request */}

      {/* Progress indicator */}
      <section className="py-4 border-b border-border bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2 md:gap-4">
            {[
              { n: 1, label: t("Type", "प्रकार") },
              { n: 2, label: t("Date", "दिनांक") },
              { n: 3, label: t("Time", "समय") },
              { n: 4, label: t("Details", "विवरण") },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-1 md:gap-2">
                {i > 0 && <div className={`w-6 md:w-16 h-0.5 rounded-full transition-colors ${stepNumber >= s.n ? "bg-primary" : "bg-border"}`} />}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${stepNumber >= s.n ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground"}`}>{stepNumber > s.n ? "✓" : s.n}</div>
                <span className={`text-xs hidden sm:inline transition-colors ${stepNumber >= s.n ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4">

          {/* Step 1: Select type */}
          {step === "select" && (
            <div className="max-w-6xl mx-auto">
              {/* Special: Anil Bansal — premium hero card */}
              {special.active && (
                <div className="relative overflow-hidden rounded-3xl mb-6 md:mb-10 border border-cta/30 bg-linear-to-br from-[color-mix(in_oklab,var(--primary)_8%,transparent)] via-background to-[color-mix(in_oklab,var(--cta)_10%,transparent)] shadow-xl">
                  <div className="relative grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 p-5 md:p-8 items-center">
                    {/* Mobile-only title block at the very top */}
                    <div className="order-1 md:hidden text-center">
                      <div className="inline-flex items-center gap-1.5 bg-cta/15 text-cta px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide mb-3">
                        <Sparkles className="h-3 w-3" /> {t("Special Consultation", "विशेष परामर्श")}
                      </div>
                      <h2 className="text-3xl font-extrabold text-primary leading-none tracking-tight">
                        {lang === "hi" ? special.nameHi : special.name}
                      </h2>
                      <p className="text-lg text-primary/85 font-bold mt-2">
                        {lang === "hi" ? special.subtitleHi : special.subtitle}
                      </p>
                      {(special.tagline || special.taglineHi) && (
                        <p className="text-sm text-muted-foreground italic mt-1.5">
                          “{lang === "hi" ? (special.taglineHi || special.tagline) : (special.tagline || special.taglineHi)}”
                        </p>
                      )}

                    </div>

                    <div className="order-3 md:order-1">
                      <div className="hidden md:block">
                        <div className="inline-flex items-center gap-1.5 bg-cta/15 text-cta px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide mb-4">
                          <Sparkles className="h-3 w-3" /> {t("Special Consultation", "विशेष परामर्श")}
                        </div>
                        <h2 className="text-3xl md:text-5xl font-extrabold text-primary leading-none tracking-tight">
                          {lang === "hi" ? special.nameHi : special.name}
                        </h2>
                        <p className="text-lg md:text-xl text-primary/85 font-bold mt-2">
                          {lang === "hi" ? special.subtitleHi : special.subtitle}
                        </p>
                        {(special.tagline || special.taglineHi) && (
                          <p className="text-sm md:text-base text-muted-foreground italic mt-2">
                            “{lang === "hi" ? (special.taglineHi || special.tagline) : (special.tagline || special.taglineHi)}”
                          </p>
                        )}
                      </div>



                       {/* Stats row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                        {[
                          { icon: "🧘", top: special.experience, topHi: special.experienceHi, label: t("Experience", "अनुभव") },
                          { icon: "👥", top: special.clients.split(" ")[0], topHi: special.clientsHi.split(" ")[0], label: t("Happy Clients", "खुश ग्राहक") },
                          { icon: "🛡", top: t("Holistic", "समग्र"), topHi: "समग्र", label: t("Wellness Approach", "स्वास्थ्य दृष्टिकोण") },
                          { icon: "💚", top: t("Personalized", "व्यक्तिगत"), topHi: "व्यक्तिगत", label: t("Care for Better You", "आपके लिए बेहतर देखभाल") },
                        ].map((s, i) => (
                          <div key={i} className="bg-card/80 backdrop-blur rounded-xl p-3 border border-primary/10 flex gap-2 items-center">
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base shrink-0">{s.icon}</div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-extrabold text-foreground leading-tight truncate">{lang === "hi" ? s.topHi : s.top}</p>
                              <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Rating pill moved directly below the doctor's photo (see right column) */}

                      {/* Price & CTA row */}
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <div className="flex items-baseline gap-2 bg-card/80 backdrop-blur rounded-2xl px-4 py-2.5 border border-cta/20">
                          <span className="text-muted-foreground line-through text-sm">₹{special['mrp']}</span>
                          <span className="text-3xl md:text-4xl font-extrabold text-cta">₹{special['price']}</span>
                          <span className="bg-cta/15 text-cta text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            {special['mrp'] > 0 ? Math.round(((special['mrp'] - special['price']) / special['mrp']) * 100) : 0}% OFF
                          </span>
                        </div>
                        {special.duration && (
                          <div className="inline-flex items-center gap-1.5 bg-card/80 backdrop-blur rounded-full px-3 py-1.5 border border-primary/15 text-xs font-semibold text-foreground">
                            <Clock className="h-3.5 w-3.5 text-primary" /> {special.duration}
                          </div>
                        )}

                        <button onClick={() => handleSelectType(buildSpecialType(special))}
                          className="flex-1 min-w-[220px] bg-cta text-cta-foreground px-6 py-3.5 rounded-2xl font-extrabold text-sm md:text-base hover:opacity-95 shadow-lg shadow-cta/30 flex items-center justify-center gap-2 transition-all duration-150 active:scale-95 active:shadow-inner active:brightness-90">
                          📅 {t("Book Your Consultation Now", "अभी परामर्श बुक करें")} <ChevronRight className="h-5 w-5" />
                        </button>

                        {/* Rating — same row as price & CTA */}
                        <div className="inline-flex items-center gap-2 bg-card/90 backdrop-blur border border-primary/10 rounded-full px-4 py-2.5 shadow-sm">
                          <span className="text-cta">★</span>
                          <span className="text-sm font-bold text-foreground">{special.rating}</span>
                          <span className="text-xs text-muted-foreground">({special.reviewsCount} {t("Reviews", "समीक्षाएँ")})</span>
                        </div>
                      </div>
                    </div>

                    <div className="order-2 md:order-2 relative mx-auto md:mx-0 self-start flex flex-col items-center md:items-end gap-4">
                      <div className="relative">
                        <div className="relative w-40 h-40 md:w-56 md:h-56 rounded-full overflow-hidden ring-4 ring-cta/50 bg-primary/10">
                          <img loading="lazy" decoding="async" src={special.photoUrl || anilBansalAsset.url} alt={special.name}
                            onError={(e) => { const el = e.currentTarget; if (el.src.indexOf("doctor-anil-bansal.png") === -1) el.src = "/doctor-anil-bansal.png"; }}
                            className="w-full h-full object-cover object-top" />
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Feature strip */}
                  <div className="relative border-t border-border/60 bg-card/40 backdrop-blur px-4 md:px-6 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      {[
                        { icon: "🛡", title: t("100% Secure Booking", "100% सुरक्षित बुकिंग"), sub: t("Your data is safe", "आपका डेटा सुरक्षित") },
                        { icon: "🎧", title: t("Expert Guidance", "विशेषज्ञ मार्गदर्शन"), sub: t("From experienced experts", "अनुभवी विशेषज्ञ") },
                        { icon: "⏰", title: t("On-time Consultation", "समय पर परामर्श"), sub: t("Punctual sessions", "समयनिष्ठ सत्र") },
                        
                        { icon: "🌱", title: t("Natural & Holistic", "प्राकृतिक और समग्र"), sub: t("Root-cause healing", "जड़-मूल उपचार") },
                      ].map((f, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">{f.icon}</div>
                          <p className="text-[11px] font-bold text-foreground leading-tight">{f.title}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight">{f.sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Type selector */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-primary text-lg">🌿</span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">{t("Select Consultation Type", "परामर्श प्रकार चुनें")}</h2>
                <span className="text-primary text-lg">🌿</span>
              </div>
              <p className="text-center text-muted-foreground text-sm mb-8">{t("Choose the type of consultation you need", "वह परामर्श प्रकार चुनें जो आपको चाहिए")}</p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {consultationTypes.map((ct, idx) => (
                  <div key={ct.name}
                    className="relative bg-card rounded-2xl p-4 md:p-5 shadow-sm border border-border hover:shadow-xl hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 group flex flex-col text-center">
                    {idx === 0 && (
                      <div className="absolute top-0 left-0 z-10">
                        <div className="bg-cta text-cta-foreground text-[9px] font-extrabold px-3 py-1 rounded-br-xl rounded-tl-2xl uppercase tracking-wide shadow">
                          ⭐ {t("Popular", "लोकप्रिय")}
                        </div>
                      </div>
                    )}
                    <div className="mx-auto w-20 h-20 md:w-24 md:h-24 rounded-full bg-linear-to-br from-primary/10 to-cta/10 flex items-center justify-center text-4xl md:text-5xl mb-3 group-hover:scale-105 transition-transform">
                      {ct.icon}
                    </div>
                    <h3 className="font-extrabold text-foreground text-sm md:text-base leading-tight">
                      {lang === "hi" ? ct.nameHi : ct.name}
                    </h3>
                    {(ct.description || ct.descriptionHi) && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug line-clamp-3">
                        {lang === "hi" ? (ct.descriptionHi || ct.description) : (ct.description || ct.descriptionHi)}
                      </p>
                    )}
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mt-2">
                      <Clock className="h-3 w-3" /> {ct.duration}
                    </div>
                    <div className="flex items-baseline justify-center gap-2 mt-2">
                      <span className="text-muted-foreground line-through text-xs">₹{ct['mrp']}</span>
                      <span className="text-lg font-extrabold text-foreground">₹{ct['price']}</span>
                    </div>
                    <button onClick={() => handleSelectType(ct)}
                      className="mt-3 bg-primary text-primary-foreground rounded-full px-4 py-2 text-xs font-extrabold hover:opacity-90 shadow flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 active:shadow-inner active:brightness-90">
                      {t("Book Now", "अभी बुक करें")} <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Trust triple grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h4 className="font-extrabold text-foreground mb-3">{t("Why Choose Us?", "हमें क्यों चुनें?")}</h4>
                  <ul className="space-y-2 text-sm text-foreground/85">
                    {[
                      t("Natural & Holistic Approach", "प्राकृतिक और समग्र दृष्टिकोण"),
                      t("Personalized Treatment Plans", "व्यक्तिगत उपचार योजनाएँ"),
                      t("No Side Effects", "कोई साइड इफेक्ट नहीं"),
                      t("Lifestyle & Diet Guidance", "जीवनशैली और आहार मार्गदर्शन"),
                      t("Proven Results", "सिद्ध परिणाम"),
                      t("Trusted by Thousands", "हजारों द्वारा भरोसेमंद"),
                    ].map((s, i) => (
                      <li key={i} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h4 className="font-extrabold text-foreground mb-3">{t("Our Expertise", "हमारी विशेषज्ञता")}</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { i: "⚖️", l: t("Weight Loss", "वजन घटाना") },
                      { i: "🧘", l: t("Stress Relief", "तनाव से राहत") },
                      { i: "💧", l: t("Detox & Cleanse", "डिटॉक्स") },
                      { i: "🛡", l: t("Immunity Boost", "प्रतिरक्षा") },
                      { i: "🌸", l: t("PCOD/PCOS Care", "पीसीओडी देखभाल") },
                      { i: "🦋", l: t("Thyroid Support", "थायरॉइड सहायता") },
                    ].map((e, i) => (
                      <div key={i} className="p-2 rounded-lg bg-primary/5">
                        <div className="text-lg">{e.i}</div>
                        <p className="text-[10px] font-semibold text-foreground mt-0.5 leading-tight">{e.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* What Clients Say — moved to the very bottom */}
              {special.active && special.reviews && special.reviews.length > 0 && (
                <div className="mt-10 bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-cta text-xl">★</span>
                    <h3 className="text-xl md:text-2xl font-extrabold text-foreground">
                      {t("What Clients Say", "ग्राहक क्या कहते हैं")}
                    </h3>
                    <span className="text-cta text-xl">★</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {special.reviews.map((r, i) => (
                      <div key={i} className="bg-linear-to-br from-primary/5 to-cta/5 border border-border/60 rounded-xl p-4">
                        <div className="text-cta text-sm mb-1.5">{"★".repeat(r.rating || 5)}</div>
                        <p className="text-sm text-foreground/85 italic leading-snug mb-2">"{lang === "hi" ? (r.textHi || r.text) : r.text}"</p>
                        <p className="text-xs font-bold text-foreground">— {r.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date */}
          {step === "date" && (
            <div className="max-w-md mx-auto">
              <button onClick={() => setStep("select")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition">
                <ChevronLeft className="h-4 w-4" /> {t("Back", "वापस")}
              </button>
              <div className="bg-card rounded-2xl border border-border p-6 shadow-lg">
                <h3 className="font-bold text-foreground mb-4 text-lg">{t("Select a Date", "दिनांक चुनें")}</h3>
                <div className="bg-linear-to-r from-primary/5 to-primary/10 rounded-xl p-3 mb-4 text-sm border border-primary/10">
                  <span className="font-semibold">{lang === "hi" ? selectedType.nameHi : selectedType.name}</span>
                  <span className="text-muted-foreground ml-2">• {selectedType.duration} • ₹{selectedType['price']}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} className="p-2 hover:bg-muted rounded-lg transition"><ChevronLeft className="h-5 w-5" /></button>
                  <span className="font-bold text-foreground">{MONTHS[calMonth]} {calYear}</span>
                  <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} className="p-2 hover:bg-muted rounded-lg transition"><ChevronRight className="h-5 w-5" /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {DAYS.map(d => <div key={d} className="font-bold text-muted-foreground py-1.5">{d}</div>)}
                  {calendarDays.map((day, i) => (
                    <div key={i}>
                      {day ? (
                        <button onClick={() => handleDateSelect(day)} disabled={!isDateSelectable(day)}
                          className={`w-full aspect-square rounded-xl text-sm font-medium transition-all
                            ${isSelected(day) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110" : isDateSelectable(day) ? "hover:bg-primary/10 hover:text-primary text-foreground" : "text-muted-foreground/30 cursor-not-allowed"}`}>
                          {day}
                        </button>
                      ) : <div />}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">{t("Tap a date to continue", "आगे बढ़ने के लिए दिनांक पर टैप करें")}</p>
              </div>
            </div>
          )}

          {/* Step 3: Time — only upcoming */}
          {step === "time" && (
            <div className="max-w-md mx-auto">
              <button onClick={() => setStep("date")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition">
                <ChevronLeft className="h-4 w-4" /> {t("Back", "वापस")}
              </button>
              <div className="bg-card rounded-2xl border border-border p-6 shadow-lg">
                <h3 className="font-bold text-foreground mb-2 text-lg">{t("Select a Time", "समय चुनें")}</h3>
                <div className="bg-linear-to-r from-primary/5 to-primary/10 rounded-xl p-3 mb-4 text-sm border border-primary/10">
                  <span className="font-semibold">{formattedDate}</span>
                  <span className="text-muted-foreground ml-2">• {lang === "hi" ? selectedType.nameHi : selectedType.name}</span>
                </div>
                {availableTimeSlots.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">{t("No available time slots for today.", "आज के लिए कोई समय उपलब्ध नहीं है।")}</p>
                    <button onClick={() => setStep("date")} className="mt-3 text-primary text-sm font-semibold hover:underline">
                      {t("← Choose another date", "← दूसरी दिनांक चुनें")}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 max-h-[350px] overflow-y-auto pr-1">
                      {availableTimeSlots.map(time => (
                        <button key={time} onClick={() => handleTimeSelect(time)}
                          className={`py-3 rounded-xl text-xs font-semibold border-2 transition-all
                            ${selectedTime === time ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105" : "border-border text-foreground hover:border-primary hover:text-primary hover:bg-primary/5"}`}>
                          {time}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-4">{t("Tap a time to continue", "आगे बढ़ने के लिए समय पर टैप करें")}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Patient details */}
          {step === "details" && (
            <div className="max-w-lg mx-auto">
              <button onClick={() => setStep("time")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition">
                <ChevronLeft className="h-4 w-4" /> {t("Back", "वापस")}
              </button>
              <div className="bg-card rounded-2xl p-6 md:p-8 shadow-xl border border-border">
                <div className="bg-linear-to-r from-primary/5 to-primary/10 rounded-xl p-4 mb-6 border border-primary/10">
                  <p className="text-sm font-bold text-foreground">
                    {isSpecialSelected ? t("Special Consultation", "विशेष परामर्श") : (lang === "hi" ? selectedType.nameHi : selectedType.name)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">📅 {formattedDate} • 🕐 {selectedTime} • ⏱ {selectedType.duration}</p>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-5">{t("Your Details", "आपका विवरण")}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Consultation Mode */}
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">{t("Consultation Type", "परामर्श प्रकार")}</label>
                    <div className="flex flex-wrap gap-4">
                      {CONSULTATION_MODES.map(mode => (
                        <label key={mode.key} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="consultation_mode" value={mode.key} checked={consultationMode.key === mode.key}
                            onChange={() => setConsultationMode(mode)}
                            className="w-4 h-4 text-primary accent-primary" />
                          <span className="text-sm text-foreground">{lang === "hi" ? mode.labelHi : mode.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">{t("Payment Mode", "भुगतान विधि")}</label>
                    {isSpecialSelected && special.prepaidOnly ? (
                      <div className="flex items-center gap-2 bg-cta/10 border border-cta/30 rounded-xl px-4 py-3">
                        <span className="text-lg">💳</span>
                        <div>
                          <p className="text-sm font-bold text-cta">{t("Prepaid Only", "केवल प्रीपेड")}</p>
                          <p className="text-[11px] text-muted-foreground">{t(`Pay ₹${special['price']} securely via Razorpay to confirm your appointment instantly.`, `अपॉइंटमेंट तुरंत कन्फर्म करने के लिए ₹${special['price']} Razorpay से सुरक्षित भुगतान करें।`)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="payment_mode" checked={paymentMode === "postpaid"} onChange={() => setPaymentMode("postpaid")} className="w-4 h-4 text-primary accent-primary" />
                          <span className="text-sm text-foreground">{t("Pay After Consultation", "परामर्श के बाद भुगतान")}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="payment_mode" checked={paymentMode === "prepaid"} onChange={() => setPaymentMode("prepaid")} className="w-4 h-4 text-primary accent-primary" />
                          <span className="text-sm text-foreground">{t("Prepaid", "प्रीपेड")}</span>
                        </label>
                      </div>
                    )}
                  </div>
                  <input required value={form.patient_name} onChange={e => setForm({ ...form, patient_name: e.target.value })}
                    placeholder={t("Patient Name *", "मरीज का नाम *")} autoComplete="name"
                    className="w-full px-4 py-3.5 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background transition-all" />
                  <div className="grid grid-cols-2 gap-3">
                    <input required value={form['mobile']} onChange={e => setForm({ ...form, mobile: e.target.value })}
                      placeholder={t("Mobile *", "मोबाइल *")} type="tel"
                      className="w-full px-4 py-3.5 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background transition-all" />
                    <select value={form.age} onChange={e => setForm({ ...form, age: e.target.value })}
                      className="w-full px-4 py-3.5 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background transition-all">
                      <option value="">{t("Select Age", "उम्र चुनें")}</option>
                      {Array.from({ length: 73 }, (_, i) => i + 8).map(age => (
                        <option key={age} value={String(age)}>{age} {t("Years", "वर्ष")}</option>
                      ))}
                    </select>
                  </div>
                  <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-4 py-3.5 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background transition-all">
                    <option value="">{t("Select Gender", "लिंग चुनें")}</option>
                    <option value="male">{t("Male", "पुरुष")}</option>
                    <option value="female">{t("Female", "महिला")}</option>
                    <option value="other">{t("Other", "अन्य")}</option>
                  </select>
                  <CitySearchInput value={form.city} onChange={(val) => setForm({ ...form, city: val })} t={t} />
                  <input value={form.disease} onChange={e => setForm({ ...form, disease: e.target.value })}
                    placeholder={t("Disease / Health Concern", "बीमारी / स्वास्थ्य समस्या")}
                    className="w-full px-4 py-3.5 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background transition-all" />

                  {/* File Upload - Single Area */}
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1 block">
                      {t("Upload Files", "फ़ाइलें अपलोड करें")}
                    </label>
                    <p className="text-xs text-muted-foreground mb-3">{t("Optional - Upload any relevant files", "वैकल्पिक - कोई भी संबंधित फ़ाइलें अपलोड करें")}</p>
                    
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50">
                      {uploading ? <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload className="h-6 w-6" />}
                      <span className="text-sm font-medium">{uploading ? t("Uploading...", "अपलोड हो रहा है...") : t("Click to Upload", "अपलोड करने के लिए क्लिक करें")}</span>
                      <span className="text-xs text-muted-foreground">Video · Audio · PDF · Photo</span>
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="video/*,audio/*,.pdf,image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {uploadedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {uploadedFiles.map((file, i) => (
                          <div key={i} className="flex items-center gap-2 bg-primary/10 rounded-xl p-3 border border-primary/30">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-xs text-foreground flex-1 truncate">{file.name}</span>
                            <button type="button" onClick={() => removeFile(i)} className="text-destructive hover:opacity-80"><X className="h-4 w-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Detailed Note */}
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-2 block">
                      {t("Additional Details", "अतिरिक्त विवरण")}
                    </label>
                    <textarea value={form.prescription_note} onChange={e => setForm({ ...form, prescription_note: e.target.value })}
                      placeholder={t("Please Feel Free To Share Any Details That Will Help Us Better Understand Your Concern...", "कृपया कोई भी विवरण साझा करें जो आपकी समस्या को बेहतर समझने में हमारी मदद करेगा...")}
                      className="w-full px-4 py-3.5 border-2 border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background resize-none transition-all"
                      rows={4} />
                  </div>

                  <button type="submit" disabled={submitting}
                    className="w-full bg-linear-to-r from-primary to-primary/90 text-primary-foreground py-4 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-60">
                    {submitting ? t("Processing...", "प्रोसेस हो रहा है...") : (isSpecialSelected && special.prepaidOnly ? t(`💳 Pay ₹${special['price']} & Book`, `💳 ₹${special['price']} भुगतान और बुक करें`) : t("✨ Book Appointment", "✨ अपॉइंटमेंट बुक करें"))}
                  </button>
                </form>
                <div className="mt-5 text-center">
                  <a href="tel:+919876543210" className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:underline">
                    <Phone className="h-4 w-4" /> {t("Or Call Us Directly", "या हमें सीधे कॉल करें")}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* My Consultations History */}
      {session && myConsultations.length > 0 && (
        <section className="container mx-auto px-4 py-8 max-w-3xl">
          <button onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between bg-card rounded-xl border border-border p-4 hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-foreground">{t("My Consultations", "मेरी परामर्श")}</h2>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{myConsultations.length}</span>
            </div>
            <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${showHistory ? "rotate-90" : ""}`} />
          </button>
          {showHistory && (
            <div className="mt-3 space-y-3">
              {myConsultations.map(c => {
                const statusColor = c.status === "completed" ? "bg-green-100 text-green-800" :
                  c.status === "cancelled" ? "bg-red-100 text-red-800" :
                  c.status === "contacted" ? "bg-blue-100 text-blue-800" :
                  "bg-yellow-100 text-yellow-800";
                return (
                  <div key={c.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{c.consultation_type}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {c.consultation_date && new Date(c.consultation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {c.consultation_time && ` • ${c.consultation_time}`}
                        </p>
                        {c.disease && <p className="text-xs text-muted-foreground mt-1">{t("Concern:", "समस्या:")} {c.disease}</p>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusColor}`}>
                        {c.status || "pending"}
                      </span>
                    </div>
                    {c.prescription_note && (
                      <div className="mt-2 bg-muted rounded-lg p-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{t("Your Note:", "आपका नोट:")}</span> {c.prescription_note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* OTP Verification Modal for guest consultation submissions */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !otpSending && !submitting && setShowOtpModal(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-1 text-center">{t("Verify Your Mobile", "अपना मोबाइल सत्यापित करें")}</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              {t("OTP sent to", "OTP भेजा गया")} <span className="font-semibold text-foreground">{form['mobile'].replace(/\D/g, '').slice(-10)}</span>
            </p>
            <div className="flex justify-center gap-1 mb-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otpCode[i] || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const newOtp = otpCode.split('');
                    newOtp[i] = val;
                    setOtpCode(newOtp.join('').slice(0, 6));
                    if (val && e.target.nextElementSibling) {
                      (e.target.nextElementSibling as HTMLInputElement).focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otpCode[i] && e.currentTarget.previousElementSibling) {
                      (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
                    }
                  }}
                  className="w-11 h-12 text-center text-lg font-bold border-2 border-border rounded-xl bg-background focus:border-primary focus:outline-none"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleVerifyConsultationOtp}
              disabled={otpSending || submitting || otpCode.length !== 6}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {otpSending || submitting ? t("Verifying...", "सत्यापित हो रहा...") : t("Verify & Book Appointment", "सत्यापित करें और बुक करें")}
            </button>
            <div className="text-center mt-3">
              {otpCountdown > 0 ? (
                <p className="text-xs text-muted-foreground">{t("Resend in", "दोबारा भेजें")} {otpCountdown}s</p>
              ) : (
                <button type="button" onClick={handleResendConsultationOtp} disabled={otpSending} className="text-xs text-primary font-semibold hover:underline">
                  {t("Resend OTP", "OTP दोबारा भेजें")}
                </button>
              )}
            </div>
            <button type="button" onClick={() => setShowOtpModal(false)} disabled={otpSending || submitting} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-2">
              {t("Cancel", "रद्द करें")}
            </button>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
};

export default ConsultationPage;