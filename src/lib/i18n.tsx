"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type Locale = "tr" | "en" | "ar";

const translations = {
  tr: {
    appName: "GHISA Toptan",
    subtitle: "Toptan Satis Portali",
    home: "Ana Sayfa",
    products: "Urunler",
    cart: "Sepet",
    login: "Giris Yap",
    logout: "Cikis Yap",
    loading: "Yukleniyor...",
    loggingIn: "Giris yapiliyor...",
    email: "E-posta",
    emailPlaceholder: "E-posta adresiniz",
    password: "Sifre",
    passwordPlaceholder: "Sifre",
    loginFailed: "E-posta veya sifre hatali",
    connectionError: "Baglanti hatasi",
    categories: "Kategoriler",
    allCategories: "Tum Kategoriler",
    allProducts: "Tum Urunler",
    noProducts: "Urun bulunamadi",
    addToCart: "Sepete Ekle",
    selectColor: "Renk Secin",
    inStock: "Stokta",
    outOfStock: "Tukendi",
    colors: "Renkler",
    sizes: "Bedenler",
    lotInfo: "Siparis miktari seri (lot) bazindadir. Her seri, secili renkte tum bedenleri icerir.",
    lotSizes: "Serideki bedenler",
    lotQuantity: "Seri adedi",
    sortBy: "Sirala",
    sortPriceLow: "Fiyat: Dusukten Yuksege",
    sortPriceHigh: "Fiyat: Yuksekten Dusuge",
    sortNameAZ: "Isim: A-Z",
    sortNameZA: "Isim: Z-A",
    sortNewest: "En Yeniler",
    productCode: "Urun Kodu",
    specifications: "Urun Detaylari",
    retailPrice: "Perakende",
    wholesalePrice: "Toptan Fiyat",
    campaignDiscount: "Kampanya Indirimi",
    unitPrice: "Birim Fiyat",
    lotPrice: "Seri Fiyati",
    pieces: "adet",
    yourCart: "Sepetiniz",
    emptyCart: "Sepetiniz bos",
    total: "Toplam",
    placeOrder: "Siparis Ver",
    orderNotes: "Siparis Notlari",
    orderNotesPlaceholder: "Siparis ile ilgili notlariniz...",
    remove: "Kaldir",
    continueShopping: "Alisverise Devam Et",
    orderSuccess: "Siparisini basariyla gonderildi!",
    orderSuccessDetail: "Siparis detaylariniz e-posta ile iletildi. En kisa surede sizinle iletisime gececegiz.",
    quantity: "Adet",
    lotCount: "Seri",
    loginRequired: "Siparis vermek icin giris yapmaniz gerekmektedir.",
    noAccount: "Hesabiniz yok mu? info@ghisa.com adresine yazin.",
    heroTitle: "GHISA Toptan Satis",
    heroSubtitle: "Toptan siparis taleplerinizi kolayca olusturun",
    language: "Dil",
    currency: "Para Birimi",
    // Navigation & chrome
    stores: "Magazalar",
    faq: "S.S.S.",
    account: "Hesabim",
    announcement: "GHISA Toptan — bayilere ozel fiyatlar, seri (lot) bazli siparis",
    // Footer
    aboutText:
      "GHISA, modern ve zarif kadin giyiminde one cikan bir marka. Toptan portali uzerinden bayilerimize ozel koleksiyon ve fiyatlar sunuyoruz.",
    quickLinks: "Hizli Baglantilar",
    customerService: "Musteri Hizmetleri",
    followUs: "Bizi Takip Edin",
    newsletter: "Bulten",
    newsletterText: "Yeni koleksiyon ve kampanyalardan ilk siz haberdar olun.",
    subscribe: "Abone Ol",
    allRights: "Tum haklari saklidir.",
    contact: "Iletisim",
    // Stores
    storesTitle: "Magazalarimiz",
    storesSubtitle: "Turkiye genelinde GHISA magazalarini kesfedin.",
    allCities: "Tum Sehirler",
    viewOnMap: "Haritada Gor",
    phone: "Telefon",
    hours: "Calisma Saatleri",
    address: "Adres",
    noStores: "Magaza bulunamadi",
    storesWord: "magaza",
    // FAQ
    faqTitle: "Sikca Sorulan Sorular",
    faqSubtitle: "Toptan siparisler hakkinda merak edilenler.",
    faqMoreTitle: "Sorunuz mu var?",
    faqMoreText: "Aradiginiz yaniti bulamadiysaniz bizimle iletisime gecin.",
  },
  en: {
    appName: "GHISA Wholesale",
    subtitle: "Wholesale Portal",
    home: "Home",
    products: "Products",
    cart: "Cart",
    login: "Login",
    logout: "Logout",
    loading: "Loading...",
    loggingIn: "Logging in...",
    email: "Email",
    emailPlaceholder: "Your email",
    password: "Password",
    passwordPlaceholder: "Password",
    loginFailed: "Invalid email or password",
    connectionError: "Connection error",
    categories: "Categories",
    allCategories: "All Categories",
    allProducts: "All Products",
    noProducts: "No products found",
    addToCart: "Add to Cart",
    selectColor: "Select Color",
    inStock: "In Stock",
    outOfStock: "Out of Stock",
    colors: "Colors",
    sizes: "Sizes",
    lotInfo: "Order quantity is per lot (seri). Each lot includes all sizes in the selected color.",
    lotSizes: "Sizes in lot",
    lotQuantity: "Lot quantity",
    sortBy: "Sort by",
    sortPriceLow: "Price: Low to High",
    sortPriceHigh: "Price: High to Low",
    sortNameAZ: "Name: A-Z",
    sortNameZA: "Name: Z-A",
    sortNewest: "Newest",
    productCode: "Product Code",
    specifications: "Specifications",
    retailPrice: "Retail",
    wholesalePrice: "Wholesale Price",
    campaignDiscount: "Campaign Discount",
    unitPrice: "Unit Price",
    lotPrice: "Lot Price",
    pieces: "pcs",
    yourCart: "Your Cart",
    emptyCart: "Your cart is empty",
    total: "Total",
    placeOrder: "Place Order",
    orderNotes: "Order Notes",
    orderNotesPlaceholder: "Any notes about your order...",
    remove: "Remove",
    continueShopping: "Continue Shopping",
    orderSuccess: "Your order has been submitted!",
    orderSuccessDetail: "Order details have been sent via email. We will contact you shortly.",
    quantity: "Qty",
    lotCount: "Lot",
    loginRequired: "Please login to place an order.",
    noAccount: "Don't have an account? Email info@ghisa.com",
    heroTitle: "GHISA Wholesale",
    heroSubtitle: "Create your wholesale order requests easily",
    language: "Language",
    currency: "Currency",
    // Navigation & chrome
    stores: "Stores",
    faq: "FAQ",
    account: "Account",
    announcement: "GHISA Wholesale — exclusive dealer pricing, ordered by lot (seri)",
    // Footer
    aboutText:
      "GHISA is a leading brand in modern, elegant womenswear. Our wholesale portal offers dealers exclusive collections and pricing.",
    quickLinks: "Quick Links",
    customerService: "Customer Service",
    followUs: "Follow Us",
    newsletter: "Newsletter",
    newsletterText: "Be the first to hear about new collections and campaigns.",
    subscribe: "Subscribe",
    allRights: "All rights reserved.",
    contact: "Contact",
    // Stores
    storesTitle: "Our Stores",
    storesSubtitle: "Discover GHISA stores across Türkiye.",
    allCities: "All Cities",
    viewOnMap: "View on Map",
    phone: "Phone",
    hours: "Opening Hours",
    address: "Address",
    noStores: "No stores found",
    storesWord: "stores",
    // FAQ
    faqTitle: "Frequently Asked Questions",
    faqSubtitle: "Everything about wholesale ordering.",
    faqMoreTitle: "Still have questions?",
    faqMoreText: "If you couldn't find what you were looking for, get in touch.",
  },
  ar: {
    appName: "غيسا بالجملة",
    subtitle: "بوابة البيع بالجملة",
    home: "الرئيسية",
    products: "المنتجات",
    cart: "السلة",
    login: "تسجيل الدخول",
    logout: "تسجيل الخروج",
    loading: "جاري التحميل...",
    loggingIn: "جاري تسجيل الدخول...",
    email: "البريد الإلكتروني",
    emailPlaceholder: "بريدك الإلكتروني",
    password: "كلمة المرور",
    passwordPlaceholder: "كلمة المرور",
    loginFailed: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    connectionError: "خطأ في الاتصال",
    categories: "الفئات",
    allCategories: "جميع الفئات",
    allProducts: "جميع المنتجات",
    noProducts: "لم يتم العثور على منتجات",
    addToCart: "أضف إلى السلة",
    selectColor: "اختر اللون",
    inStock: "متوفر",
    outOfStock: "نفد المخزون",
    colors: "الألوان",
    sizes: "المقاسات",
    lotInfo: "كمية الطلب لكل مجموعة. كل مجموعة تشمل جميع المقاسات باللون المحدد.",
    lotSizes: "المقاسات في المجموعة",
    lotQuantity: "عدد المجموعات",
    sortBy: "ترتيب حسب",
    sortPriceLow: "السعر: من الأقل إلى الأعلى",
    sortPriceHigh: "السعر: من الأعلى إلى الأقل",
    sortNameAZ: "الاسم: أ-ي",
    sortNameZA: "الاسم: ي-أ",
    sortNewest: "الأحدث",
    productCode: "رمز المنتج",
    specifications: "المواصفات",
    retailPrice: "التجزئة",
    wholesalePrice: "سعر الجملة",
    campaignDiscount: "خصم الحملة",
    unitPrice: "سعر الوحدة",
    lotPrice: "سعر المجموعة",
    pieces: "قطعة",
    yourCart: "سلتك",
    emptyCart: "سلتك فارغة",
    total: "المجموع",
    placeOrder: "إرسال الطلب",
    orderNotes: "ملاحظات الطلب",
    orderNotesPlaceholder: "أي ملاحظات حول طلبك...",
    remove: "إزالة",
    continueShopping: "متابعة التسوق",
    orderSuccess: "تم إرسال طلبك بنجاح!",
    orderSuccessDetail: "تم إرسال تفاصيل الطلب عبر البريد الإلكتروني. سنتواصل معك قريباً.",
    quantity: "الكمية",
    lotCount: "مجموعة",
    loginRequired: "يرجى تسجيل الدخول لإرسال الطلب.",
    noAccount: "ليس لديك حساب؟ أرسل بريد إلى info@ghisa.com",
    heroTitle: "غيسا للبيع بالجملة",
    heroSubtitle: "أنشئ طلبات الجملة الخاصة بك بسهولة",
    language: "اللغة",
    currency: "العملة",
    // Navigation & chrome
    stores: "المتاجر",
    faq: "الأسئلة الشائعة",
    account: "حسابي",
    announcement: "غيسا بالجملة — أسعار خاصة للموزعين، الطلب حسب المجموعة",
    // Footer
    aboutText:
      "غيسا علامة تجارية رائدة في الأزياء النسائية العصرية والأنيقة. توفر بوابة البيع بالجملة لموزعينا مجموعات وأسعاراً حصرية.",
    quickLinks: "روابط سريعة",
    customerService: "خدمة العملاء",
    followUs: "تابعنا",
    newsletter: "النشرة البريدية",
    newsletterText: "كن أول من يعرف عن المجموعات والحملات الجديدة.",
    subscribe: "اشترك",
    allRights: "جميع الحقوق محفوظة.",
    contact: "اتصل بنا",
    // Stores
    storesTitle: "متاجرنا",
    storesSubtitle: "اكتشف متاجر غيسا في جميع أنحاء تركيا.",
    allCities: "جميع المدن",
    viewOnMap: "عرض على الخريطة",
    phone: "الهاتف",
    hours: "ساعات العمل",
    address: "العنوان",
    noStores: "لا توجد متاجر",
    storesWord: "متجر",
    // FAQ
    faqTitle: "الأسئلة الشائعة",
    faqSubtitle: "كل ما يتعلق بالطلب بالجملة.",
    faqMoreTitle: "لا تزال لديك أسئلة؟",
    faqMoreText: "إذا لم تجد ما تبحث عنه، تواصل معنا.",
  },
} as const;

export type TranslationKey = keyof typeof translations.tr;

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
  isRtl: boolean;
}

const I18nContext = createContext<I18nContextType>({
  locale: "tr",
  setLocale: () => {},
  t: (key) => key,
  isRtl: false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("wholesale_locale") as Locale) || "tr";
    }
    return "tr";
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("wholesale_locale", l);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[locale][key] ?? key,
    [locale],
  );

  const isRtl = locale === "ar";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [locale, isRtl]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isRtl }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
