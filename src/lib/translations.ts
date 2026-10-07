export type Language = 'ar' | 'en';

export const translations = {
  ar: {
    // المكتبة
    libraryTitle: "مكتبة Hidden Radiology",
    buyNow: "شراء الآن",
    noProducts: "لا توجد منتجات حالياً",
    switchToEnglish: "English",
    
    // صفحة الدفع
    securePayment: "دفع آمن ومضمون 100%",
    completeOrder: "إتمام الطلب",
    customerInfo: "بيانات العميل",
    fullName: "الاسم الكامل",
    emailLabel: "البريد الإلكتروني",
    emailHint: "سيتم إرسال رابط التحميل على هذا البريد",
    continueToPayment: "متابعة إلى الدفع ←",
    referenceNumber: "رقمك المرجعي للطلب (ضعه في وصف التحويل)",
    choosePayment: "اختر وسيلة الدفع",
    paymentInstructions: "📋 تعليمات الدفع:",
    instruction1: "افتح تطبيق",
    instruction2: "حول مبلغ",
    instruction3: "في خانة الوصف/المرجع، اكتب الرقم:",
    instruction4: 'اضغط "تم الدفع" بالأسفل',
    back: "← رجوع",
    paymentCompleted: "✓ تم الدفع",
    processing: "جاري التأكيد...",
    
    // نجاح الطلب
    orderReceived: "تم استلام طلبك بنجاح! 🎉",
    orderNumber: "رقم طلبك المرجعي:",
    nextStep: "الخطوة التالية:",
    reviewMessage: "سيتم مراجعة التحويل خلال",
    reviewTime: "1-24 ساعة",
    reviewMessage2: "بمجرد التأكد، سيتم إرسال رابط تحميل الكتاب فوراً إلى بريدك:",
    trackOrder: "تتبع حالة الطلب ←",
    
    // حالة الطلب
    pending: "بانتظار تأكيد الدفع",
    confirmedStatus: "تم التأكيد - جاهز للتحميل!",
    orderDetails: "تفاصيل الطلب",
    orderRef: "رقم الطلب:",
    customerName: "اسم العميل:",
    email: "البريد الإلكتروني:",
    paymentMethod: "وسيلة الدفع:",
    amount: "المبلغ:",
    pendingReview: "طلبك قيد المراجعة",
    pendingMessage: "سيتم التحقق من التحويل خلال 1-24 ساعة. بمجرد التأكيد، سيتم إرسال رابط التحميل إلى بريدك الإلكتروني تلقائياً، وستتمكن من التحميل من هذه الصفحة أيضاً.",
    confirmedMessage: "تم تأكيد الدفع بنجاح!",
    confirmedThanks: "شكراً لثقتك! يمكنك الآن تحميل الكتاب مباشرة، وقد تم إرسال نسخة إلى بريدك الإلكتروني.",
    downloadNow: "تحميل الكتاب الآن",
    downloading: "جاري التحميل...",
    refreshStatus: "🔄 تحديث حالة الطلب",
    orderNotFound: "لم يتم العثور على الطلب",
    checkReference: "تأكد من صحة رقم الطلب المرجعي",
    
    // وسائل الدفع
    vodafone: "Vodafone Cash & Fawry",
    etisalat: "Etisalat Cash",
    instapay: "InstaPay",
    paypal: "PayPal (دولي)",
    
    // لوحة التحكم
    ordersDashboard: "لوحة تحكم الطلبات",
    ordersSubtitle: "إدارة وتأكيد مدفوعات العملاء",
    refresh: "🔄 تحديث",
    logout: "خروج",
    incomingOrders: "الطلبات الواردة",
    noOrders: "لا توجد طلبات حالياً",
    noOrdersMessage: "ستظهر الطلبات الجديدة هنا بمجرد قيام العملاء بإتمام عملية الشراء.",
    confirmedBadge: "مؤكد",
    pendingConfirm: "بانتظار التأكيد",
    confirmAndDeliver: "✓ تأكيد الدفع وفتح التحميل",
    delivered: "تم تسليم الكتاب للعميل",
    date: "التاريخ:",
    password: "كلمة المرور",
    login: "دخول",
    protectedArea: "محمية - أدخل كلمة المرور للمتابعة"
  },
  
  en: {
    // Library
    libraryTitle: "Hidden Radiology Library",
    buyNow: "Buy Now",
    noProducts: "No products available yet",
    switchToArabic: "العربية",
    
    // Checkout
    securePayment: "100% Secure Payment",
    completeOrder: "Complete Your Order",
    customerInfo: "Customer Information",
    fullName: "Full Name",
    emailLabel: "Email Address",
    emailHint: "Download link will be sent to this email",
    continueToPayment: "Continue to Payment →",
    referenceNumber: "Your Reference Number (include in transfer description)",
    choosePayment: "Choose Payment Method",
    paymentInstructions: "📋 Payment Instructions:",
    instruction1: "Open the app",
    instruction2: "Transfer the amount",
    instruction3: "In the description/reference field, write:",
    instruction4: 'Click "Payment Completed" below',
    back: "← Back",
    paymentCompleted: "✓ Payment Completed",
    processing: "Processing...",
    
    // Order Success
    orderReceived: "Order Received Successfully! 🎉",
    orderNumber: "Your Order Number:",
    nextStep: "Next Step:",
    reviewMessage: "Your payment will be verified within",
    reviewTime: "1-24 hours",
    reviewMessage2: "Once confirmed, the download link will be sent immediately to your email:",
    trackOrder: "Track Order Status →",
    
    // Order Status
    pending: "Pending Payment Confirmation",
    confirmedStatus: "Confirmed - Ready to Download!",
    orderDetails: "Order Details",
    orderRef: "Order Reference:",
    customerName: "Customer Name:",
    email: "Email:",
    paymentMethod: "Payment Method:",
    amount: "Amount:",
    pendingReview: "Your Order is Under Review",
    pendingMessage: "Your payment will be verified within 1-24 hours. Once confirmed, the download link will be sent to your email automatically, and you'll also be able to download from this page.",
    confirmedMessage: "Payment Confirmed Successfully!",
    confirmedThanks: "Thank you for your trust! You can now download the book directly, and a copy has been sent to your email.",
    downloadNow: "Download Book Now",
    downloading: "Downloading...",
    refreshStatus: "🔄 Refresh Order Status",
    orderNotFound: "Order Not Found",
    checkReference: "Please check your reference number",
    
    // Payment Methods
    vodafone: "Vodafone Cash & Fawry",
    etisalat: "Etisalat Cash",
    instapay: "InstaPay",
    paypal: "PayPal (International)",
    
    // Admin Dashboard
    ordersDashboard: "Orders Dashboard",
    ordersSubtitle: "Manage and confirm customer payments",
    refresh: "🔄 Refresh",
    logout: "Logout",
    incomingOrders: "Incoming Orders",
    noOrders: "No orders yet",
    noOrdersMessage: "New orders will appear here once customers complete their purchases.",
    confirmedBadge: "Confirmed",
    pendingConfirm: "Pending Confirmation",
    confirmAndDeliver: "✓ Confirm Payment & Deliver",
    delivered: "Book Delivered to Customer",
    date: "Date:",
    password: "Password",
    login: "Login",
    protectedArea: "Protected - Enter password to continue"
  }
};

export function getTranslation(lang: Language) {
  return translations[lang];
}