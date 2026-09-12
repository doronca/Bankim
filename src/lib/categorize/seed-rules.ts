// Pre-populated Israeli merchant -> category patterns.
// Loaded once into AutoRule at DB seed time; the user can add/override from the UI.
export const SEED_RULES: { pattern: string; category: string }[] = [
  // Supermarkets
  { pattern: "שופרסל", category: "Groceries" },
  { pattern: "רמי לוי", category: "Groceries" },
  { pattern: "ויקטורי", category: "Groceries" },
  { pattern: "יינות ביתן", category: "Groceries" },
  { pattern: "מגה", category: "Groceries" },
  { pattern: "טיב טעם", category: "Groceries" },
  { pattern: "אושר עד", category: "Groceries" },

  // Utilities
  { pattern: "חברת חשמל", category: "Utilities" },
  { pattern: "עיריית", category: "Municipal Tax" },
  { pattern: "ארנונה", category: "Municipal Tax" },
  { pattern: "מקורות", category: "Utilities" },
  { pattern: "בזק", category: "Utilities" },
  { pattern: "הוט", category: "Utilities" },
  { pattern: "פרטנר", category: "Utilities" },
  { pattern: "סלקום", category: "Utilities" },
  { pattern: "פלאפון", category: "Utilities" },

  // Fuel
  { pattern: "פז", category: "Fuel" },
  { pattern: "דור אלון", category: "Fuel" },
  { pattern: "סונול", category: "Fuel" },
  { pattern: "דלק מוטורס", category: "Fuel" },
  { pattern: "paz", category: "Fuel" },

  // Subscriptions
  { pattern: "netflix", category: "Subscriptions" },
  { pattern: "spotify", category: "Subscriptions" },
  { pattern: "youtube premium", category: "Subscriptions" },
  { pattern: "apple.com/bill", category: "Subscriptions" },
  { pattern: "google \\*", category: "Subscriptions" },
  { pattern: "disney", category: "Subscriptions" },

  // Government
  { pattern: "ביטוח לאומי", category: "Government" },
  { pattern: "רשות המסים", category: "Government" },
  { pattern: "מס הכנסה", category: "Government" },

  // Salaries / income
  { pattern: "משכורת", category: "Salary" },
  { pattern: "העברת שכר", category: "Salary" },

  // Pharmacy / health
  { pattern: "סופר-פארם", category: "Health" },
  { pattern: "ניו פארם", category: "Health" },
  { pattern: "כללית", category: "Health" },
  { pattern: "מכבי", category: "Health" },

  // Transport
  { pattern: "רב-קו", category: "Transport" },
  { pattern: "gett", category: "Transport" },
  { pattern: "uber", category: "Transport" },
];
