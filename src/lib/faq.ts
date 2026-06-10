import type { Locale } from "./i18n";

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: Record<Locale, FaqItem[]> = {
  tr: [
    {
      q: "Nasil bayi / toptan musterisi olabilirim?",
      a: "Toptan hesabi acmak icin firma bilgilerinizle info@ghisa.com adresine yazin. Hesabiniz onaylandiktan sonra giris yaparak hesabiniza ozel toptan fiyatlarini gorebilirsiniz.",
    },
    {
      q: "Seri (lot) sistemi nasil calisir?",
      a: "Siparisler seri (lot) bazinda alinir. Her seri, secili renkteki tum bedenleri icerir; serideki beden dagilimini urun sayfasinda gorebilirsiniz. Adet, kac seri siparis verdiginizi ifade eder.",
    },
    {
      q: "Toptan fiyatlar nasil belirlenir?",
      a: "Toptan fiyatlar perakende fiyat uzerinden hesaplanir ve varsa kampanya indirimi uygulanir. Fiyatlar yalnizca giris yaptiginizda hesabiniza ozel olarak gosterilir.",
    },
    {
      q: "Fiyatlari hangi para biriminde gorebilirim?",
      a: "Fiyatlari TL veya USD olarak goruntuleyebilirsiniz. Doviz kuru guncel piyasa kurundan otomatik alinir; sag ustteki ₺/$ dugmesiyle gecis yapabilirsiniz.",
    },
    {
      q: "Nasil siparis veririm?",
      a: "Begendiginiz urunlerde renk ve seri adedini secip sepete ekleyin, ardindan Siparis Ver ile talebinizi olusturun. Siparisiniz e-posta ile tarafimiza iletilir ve ekibimiz en kisa surede sizinle iletisime gecer.",
    },
    {
      q: "Odeme kosullari nelerdir?",
      a: "Odeme kosullari bayi anlasmaniza gore belirlenir. Detaylar icin satis temsilciniz ile veya info@ghisa.com uzerinden iletisime gecebilirsiniz.",
    },
    {
      q: "Kargo ve teslimat nasil yapilir?",
      a: "Siparisler onaylandiktan sonra anlasmali kargo ile gonderilir. Teslimat suresi ve kosullari siparis onayinda tarafiniza iletilir.",
    },
    {
      q: "Magazalarinizi ziyaret edebilir miyim?",
      a: "Evet. Turkiye genelindeki GHISA magazalarinin adres ve calisma saatlerini Magazalar sayfasindan gorebilirsiniz.",
    },
  ],
  en: [
    {
      q: "How do I become a wholesale dealer?",
      a: "To open a wholesale account, email info@ghisa.com with your company details. Once approved, log in to see pricing tailored to your account.",
    },
    {
      q: "How does the lot (seri) system work?",
      a: "Orders are placed by lot (seri). Each lot contains all sizes in the selected color; the size breakdown is shown on the product page. Quantity refers to the number of lots.",
    },
    {
      q: "How is wholesale pricing determined?",
      a: "Wholesale prices are derived from the retail price with any campaign discount applied. Prices are shown specifically for your account once you log in.",
    },
    {
      q: "Which currencies can I view prices in?",
      a: "You can view prices in TRY or USD. The exchange rate is pulled automatically from the current market rate; switch with the ₺/$ toggle at the top right.",
    },
    {
      q: "How do I place an order?",
      a: "Add products to your cart by selecting color and lot quantity, then submit your request with Place Order. Your order is emailed to us and our team will contact you shortly.",
    },
    {
      q: "What are the payment terms?",
      a: "Payment terms are set according to your dealer agreement. For details, contact your sales representative or info@ghisa.com.",
    },
    {
      q: "How are shipping and delivery handled?",
      a: "Once confirmed, orders are dispatched via our contracted carrier. Delivery time and terms are shared at order confirmation.",
    },
    {
      q: "Can I visit your stores?",
      a: "Yes. You can find the address and opening hours of GHISA stores across Türkiye on the Stores page.",
    },
  ],
  ar: [
    {
      q: "كيف أصبح موزعاً بالجملة؟",
      a: "لفتح حساب بالجملة، راسلنا على info@ghisa.com مع بيانات شركتك. بعد الموافقة، سجّل الدخول لرؤية الأسعار الخاصة بحسابك.",
    },
    {
      q: "كيف يعمل نظام المجموعة (seri)؟",
      a: "تُقدَّم الطلبات حسب المجموعة. تحتوي كل مجموعة على جميع المقاسات باللون المحدد، ويظهر توزيع المقاسات في صفحة المنتج. وتشير الكمية إلى عدد المجموعات.",
    },
    {
      q: "كيف تُحدَّد أسعار الجملة؟",
      a: "تُحتسب أسعار الجملة من سعر التجزئة مع تطبيق أي خصم حملة. وتظهر الأسعار خاصةً لحسابك بعد تسجيل الدخول.",
    },
    {
      q: "بأي عملة يمكنني رؤية الأسعار؟",
      a: "يمكنك عرض الأسعار بالليرة التركية أو الدولار. يُؤخذ سعر الصرف تلقائياً من سعر السوق الحالي؛ بدّل عبر زر ₺/$ في الأعلى.",
    },
    {
      q: "كيف أقدّم طلباً؟",
      a: "أضِف المنتجات إلى السلة باختيار اللون وعدد المجموعات، ثم أرسل طلبك عبر زر إرسال الطلب. يصلنا طلبك عبر البريد الإلكتروني وسيتواصل فريقنا معك قريباً.",
    },
    {
      q: "ما هي شروط الدفع؟",
      a: "تُحدَّد شروط الدفع وفق اتفاقية الموزّع. للتفاصيل، تواصل مع مندوب المبيعات أو عبر info@ghisa.com.",
    },
    {
      q: "كيف يتم الشحن والتوصيل؟",
      a: "بعد التأكيد، تُشحن الطلبات عبر شركة الشحن المتعاقد معها. وتُشارك مدة وشروط التوصيل عند تأكيد الطلب.",
    },
    {
      q: "هل يمكنني زيارة متاجركم؟",
      a: "نعم. يمكنك العثور على عناوين وساعات عمل متاجر غيسا في جميع أنحاء تركيا من صفحة المتاجر.",
    },
  ],
};
