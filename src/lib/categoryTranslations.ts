// Display-name mapping for category & category-group names.
// Category/group names are stored in the DB in English (the canonical key,
// used for matching/auto-rules/filters). This maps known names to a Hebrew
// display label; user-typed custom names simply fall back to the raw string.
import type { Locale } from "./i18n";

const HE: Record<string, string> = {
  // Household preset groups
  "Home Maintenance": "תחזוקת בית",
  Utilities: "תשתיות",
  Transport: "תחבורה",
  "Health & Insurance": "בריאות וביטוח",
  "Family & Leisure": "משפחה ופנאי",
  "Income & Savings": "הכנסות וחיסכון",
  Other: "אחר",
  // Household preset categories
  Groceries: "מכולת",
  Electricity: "חשמל",
  Water: "מים",
  "Property Tax": "ארנונה",
  "Home Repairs": "תיקוני בית",
  Cleaning: "ניקיון",
  Internet: "אינטרנט",
  "Mobile Phone": "טלפון נייד",
  "TV & Streaming": "טלוויזיה וסטרימינג",
  Fuel: "דלק",
  "Public Transport": "תחבורה ציבורית",
  Parking: "חניה",
  "Car Maintenance": "תחזוקת רכב",
  Health: "בריאות",
  Pharmacy: "בית מרקחת",
  "Health Insurance": "ביטוח בריאות",
  "Life Insurance": "ביטוח חיים",
  Entertainment: "בידור",
  "Dining Out": "אוכל בחוץ",
  Vacation: "חופשה",
  Kids: "ילדים",
  Salary: "משכורת",
  Pension: "פנסיה",
  Savings: "חיסכון",
  Investments: "השקעות",
  Government: "ממשלה",
  Gifts: "מתנות",
  Education: "חינוך",
  Uncategorized: "לא מסווג",
  // Business preset groups
  "Office & Operations": "משרד ותפעול",
  "Travel & Client Costs": "נסיעות והוצאות לקוחות",
  "Professional Services": "שירותים מקצועיים",
  "People & Payroll": "כוח אדם ושכר",
  "Revenue & Taxes": "הכנסות ומיסים",
  Marketing: "שיווק",
  // Business preset categories
  "Office Supplies": "ציוד משרדי",
  "Software & Subscriptions": "תוכנה ומנויים",
  Equipment: "ציוד",
  Rent: "שכירות",
  Travel: "נסיעות",
  "Client Entertainment": "אירוח לקוחות",
  "Legal & Accounting": "ייעוץ משפטי וחשבונאות",
  "Bank Fees": "עמלות בנק",
  Payroll: "שכר עובדים",
  Contractors: "קבלני משנה",
  "Client Payments": "תשלומי לקוחות",
  Taxes: "מיסים",
  VAT: "מע״מ",
  Advertising: "פרסום",
  // Seed-rule categories not already covered above
  "Municipal Tax": "ארנונה",
  Subscriptions: "מנויים",
};

export function translateCategoryName(name: string, locale: Locale): string {
  if (locale === "en") return name;
  return HE[name] ?? name;
}
