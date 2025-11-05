export type Locale = "en" | "ar" | "fa"

export const dicts: Record<Locale, Record<string, string>> = {
  en: {
    // Navigation
    dashboard: "Dashboard",
    members: "Members",
    finance: "Finance",
    events: "Events",
    meetings: "Meetings",
    settings: "Settings",
    activityLogs: "Activity Logs",
    
    // Common
    search: "Search...",
    quickCreate: "Quick Create",
    createNew: "Create New",
    cancel: "Cancel",
    save: "Save",
    edit: "Edit",
    delete: "Delete",
    logout: "Log out",
    
    // Finance
    currentBalance: "Current Balance",
    transactions: "Transactions",
    date: "Date",
    description: "Description",
    amount: "Amount",
    uploadBankStatement: "Upload Bank Statement",
    clearAllTransactions: "Clear All Transactions",
    
    // Members
    membersList: "Members",
    createMember: "Create New Member",
    name: "Name",
    email: "Email",
    phone: "Phone Number",
    address: "Address",
    role: "Role",
    householdMembers: "Household Members",
    dateJoined: "Date Joined",
    
    // Language
    language: "Language",
    english: "English",
    arabic: "Arabic",
    persian: "Persian",
  },
  ar: {
    // Navigation
    dashboard: "لوحة القيادة",
    members: "الأعضاء",
    finance: "المالية",
    events: "الأحداث",
    meetings: "الاجتماعات",
    settings: "الإعدادات",
    activityLogs: "سجل النشاط",
    
    // Common
    search: "بحث...",
    quickCreate: "إنشاء سريع",
    createNew: "إنشاء جديد",
    cancel: "إلغاء",
    save: "حفظ",
    edit: "تعديل",
    delete: "حذف",
    logout: "تسجيل الخروج",
    
    // Finance
    currentBalance: "الرصيد الحالي",
    transactions: "المعاملات",
    date: "التاريخ",
    description: "الوصف",
    amount: "المبلغ",
    uploadBankStatement: "تحميل كشف الحساب",
    clearAllTransactions: "مسح جميع المعاملات",
    
    // Members
    membersList: "قائمة الأعضاء",
    createMember: "إضافة عضو جديد",
    name: "الاسم",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    address: "العنوان",
    role: "الدور",
    householdMembers: "أفراد الأسرة",
    dateJoined: "تاريخ الانضمام",
    
    // Language
    language: "اللغة",
    english: "الإنجليزية",
    arabic: "العربية",
    persian: "الفارسية",
  },
  fa: {
    // Navigation
    dashboard: "داشبورد",
    members: "اعضا",
    finance: "مالی",
    events: "رویدادها",
    meetings: "جلسات",
    settings: "تنظیمات",
    activityLogs: "گزارش فعالیت",
    
    // Common
    search: "جستجو...",
    quickCreate: "ایجاد سریع",
    createNew: "ایجاد جدید",
    cancel: "لغو",
    save: "ذخیره",
    edit: "ویرایش",
    delete: "حذف",
    logout: "خروج",
    
    // Finance
    currentBalance: "موجودی فعلی",
    transactions: "تراکنش‌ها",
    date: "تاریخ",
    description: "توضیحات",
    amount: "مبلغ",
    uploadBankStatement: "آپلود صورتحساب بانکی",
    clearAllTransactions: "پاک کردن همه تراکنش‌ها",
    
    // Members
    membersList: "لیست اعضا",
    createMember: "ایجاد عضو جدید",
    name: "نام",
    email: "ایمیل",
    phone: "شماره تلفن",
    address: "آدرس",
    role: "نقش",
    householdMembers: "اعضای خانواده",
    dateJoined: "تاریخ عضویت",
    
    // Language
    language: "زبان",
    english: "انگلیسی",
    arabic: "عربی",
    persian: "فارسی",
  },
}

