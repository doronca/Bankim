// Suggested starter category catalogs, offered during onboarding. Each group
// name maps to the flat category names it contains — applying a preset
// creates the CategoryGroup rows and Category rows (or assigns existing
// categories to the group if they already exist).

export const HOUSEHOLD_PRESET: Record<string, string[]> = {
  "Home Maintenance": ["Groceries", "Electricity", "Water", "Property Tax", "Home Repairs", "Cleaning"],
  Utilities: ["Internet", "Mobile Phone", "TV & Streaming"],
  Transport: ["Fuel", "Public Transport", "Parking", "Car Maintenance"],
  "Health & Insurance": ["Health", "Pharmacy", "Health Insurance", "Life Insurance"],
  "Family & Leisure": ["Entertainment", "Dining Out", "Vacation", "Kids"],
  "Income & Savings": ["Salary", "Pension", "Savings", "Investments"],
  Other: ["Government", "Gifts", "Education", "Uncategorized"],
};

export const BUSINESS_PRESET: Record<string, string[]> = {
  "Office & Operations": ["Office Supplies", "Software & Subscriptions", "Equipment", "Rent"],
  "Travel & Client Costs": ["Travel", "Client Entertainment", "Fuel"],
  "Professional Services": ["Professional Services", "Legal & Accounting", "Bank Fees"],
  "People & Payroll": ["Payroll", "Contractors"],
  "Revenue & Taxes": ["Client Payments", "Taxes", "VAT"],
  Marketing: ["Marketing", "Advertising"],
};
