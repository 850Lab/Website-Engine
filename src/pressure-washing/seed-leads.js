import { upsertPwLead, listPwLeads } from "./lead-store.js";

const SAMPLE_LEADS = [
  {
    businessName: "Cajun Seafood & Grill",
    industry: "Restaurants",
    address: "4105 Dowlen Rd",
    city: "Beaumont",
    phone: "(409) 899-0001",
    googleRating: 4.2,
    reviewCount: 840,
    flags: { hasOutdoorSeating: true, dumpsterPadLikely: true, curbAppealIssue: true },
  },
  {
    businessName: "Tex-Mex Express",
    industry: "Fast food",
    address: "3100 College St",
    city: "Beaumont",
    phone: "(409) 899-0002",
    googleRating: 3.9,
    reviewCount: 412,
    flags: { hasDriveThru: true, dumpsterPadLikely: true },
  },
  {
    businessName: "Port Arthur BBQ Pit",
    industry: "Restaurants",
    address: "1500 Procter St",
    city: "Port Arthur",
    phone: "(409) 899-0003",
    googleRating: 4.5,
    reviewCount: 620,
    flags: { hasOutdoorSeating: true, dumpsterPadLikely: true },
  },
  {
    businessName: "Nederland Donut Shop",
    industry: "Cafes",
    address: "1700 Boston Ave",
    city: "Nederland",
    phone: "(409) 899-0004",
    googleRating: 4.7,
    reviewCount: 210,
    flags: { curbAppealIssue: true },
  },
  {
    businessName: "Groves Tire & Auto",
    industry: "Tire shops",
    address: "6200 39th St",
    city: "Groves",
    phone: "(409) 899-0005",
    googleRating: 4.1,
    reviewCount: 88,
    flags: { curbAppealIssue: true },
  },
  {
    businessName: "Orange Strip Center",
    industry: "Strip centers",
    address: "1200 Green Ave",
    city: "Orange",
    phone: "(409) 899-0006",
    googleRating: 0,
    reviewCount: 0,
    flags: { dumpsterPadLikely: true, curbAppealIssue: true },
  },
  {
    businessName: "Bridge City Family Diner",
    industry: "Restaurants",
    address: "100 Texas Ave",
    city: "Bridge City",
    phone: "(409) 899-0007",
    googleRating: 4.0,
    reviewCount: 156,
    flags: { hasOutdoorSeating: false, dumpsterPadLikely: true },
  },
  {
    businessName: "Vidor Quick Lube",
    industry: "Auto repair",
    address: "800 N Main",
    city: "Vidor",
    phone: "(409) 899-0008",
    googleRating: 4.3,
    reviewCount: 95,
  },
  {
    businessName: "Lumberton Gas & Go",
    industry: "Gas stations",
    address: "500 Hwy 69",
    city: "Lumberton",
    phone: "(409) 899-0009",
    googleRating: 3.5,
    reviewCount: 44,
    flags: { hasDriveThru: false, dumpsterPadLikely: true },
  },
  {
    businessName: "Silsbee Fitness Center",
    industry: "Gyms",
    address: "700 Ave J",
    city: "Silsbee",
    phone: "(409) 899-0010",
    googleRating: 4.4,
    reviewCount: 72,
    flags: { curbAppealIssue: true },
  },
  {
    businessName: "Sour Lake Pharmacy",
    industry: "Medical offices",
    address: "200 Main St",
    city: "Sour Lake",
    phone: "(409) 899-0011",
    googleRating: 4.8,
    reviewCount: 38,
  },
  {
    businessName: "Port Neches Seafood House",
    industry: "Restaurants",
    address: "1300 Merriman St",
    city: "Port Neches",
    phone: "(409) 899-0012",
    googleRating: 4.6,
    reviewCount: 530,
    flags: { hasOutdoorSeating: true, dumpsterPadLikely: true, curbAppealIssue: true },
  },
];

export async function seedPressureWashingLeadsIfEmpty() {
  const existing = await listPwLeads();
  if (existing.length) return null;

  for (const sample of SAMPLE_LEADS) {
    await upsertPwLead({
      ...sample,
      source: "seed",
      sourceQuery: "seed",
      queueState: "available",
      status: "new",
    });
  }
  return SAMPLE_LEADS.length;
}
