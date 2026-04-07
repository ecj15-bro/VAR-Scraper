// electron/demo-seeds.js — Preset demo business profiles for testing/demonstration
// Each profile loads a fully-configured brand + business context into the file store.

const DEMO_ACCOUNTS = {
  lion: {
    id: "lion",
    label: "Lion",
    emoji: "🦁",
    color: "#e8a020",
    description: "Industrial IoT Hardware Distributor",
    brand: {
      companyName: "IronPeak Systems",
      tagline: "Industrial IoT solutions for the factory floor",
      primaryColor: "#e8a020",
      logoDataUrl: "",
    },
    businessProfile: {
      companyName: "IronPeak Systems",
      websiteUrl: "ironpeaksystems.com",
      whatYouSell:
        "Industrial IoT sensor suites and edge computing hardware for real-time production monitoring, predictive maintenance, and asset tracking on factory floors.",
      whoBuysFromYou:
        "Plant managers and operations directors at mid-size manufacturers (50-500 employees), primarily in automotive parts, metal fabrication, and food processing.",
      whyChooseYou:
        "Ruggedized hardware rated IP67 for harsh environments, 5-year hardware warranty, local 24/7 technical support, and deep integration with Rockwell and Siemens SCADA systems.",
      avgDealSize: "$25,000 – $150,000",
      salesCycleLength: "3–9 months",
      distributionModel: ["direct", "var"],
      lookingFor: [
        "Industrial automation VARs and system integrators",
        "MES/SCADA solution providers",
        "OEM equipment manufacturers seeking monitoring add-ons",
      ],
    },
  },

  cheetah: {
    id: "cheetah",
    label: "Cheetah",
    emoji: "🐆",
    color: "#00cc88",
    description: "Cloud ERP Add-On Platform",
    brand: {
      companyName: "SwiftStack",
      tagline: "The fastest path from data to decisions",
      primaryColor: "#00cc88",
      logoDataUrl: "",
    },
    businessProfile: {
      companyName: "SwiftStack",
      websiteUrl: "swiftstack.io",
      whatYouSell:
        "Cloud-native ERP enhancement modules for real-time inventory analytics, demand forecasting, and automated reorder — built to bolt onto NetSuite, Odoo, and Cin7.",
      whoBuysFromYou:
        "E-commerce and omnichannel retailers with $5M–$100M in revenue who have outgrown basic inventory management but can't afford enterprise ERP customizations.",
      whyChooseYou:
        "3-week implementation vs 6-month ERP projects, usage-based pricing starting at $299/month, native connectors to 40+ warehouse and 3PL systems, and real-time sync with zero manual data entry.",
      avgDealSize: "$3,600 – $24,000 ARR",
      salesCycleLength: "2–6 weeks",
      distributionModel: ["var", "referral"],
      lookingFor: [
        "ERP implementation partners and consultants",
        "E-commerce agency partners",
        "Accounting firms serving product-based businesses",
      ],
    },
  },

  gorilla: {
    id: "gorilla",
    label: "Gorilla",
    emoji: "🦍",
    color: "#8b5cf6",
    description: "Warehouse Automation & Robotics",
    brand: {
      companyName: "VaultRobotics",
      tagline: "Automate the warehouse. Amplify the workforce.",
      primaryColor: "#8b5cf6",
      logoDataUrl: "",
    },
    businessProfile: {
      companyName: "VaultRobotics",
      websiteUrl: "vaultrobotics.com",
      whatYouSell:
        "Autonomous mobile robot (AMR) fleets and conveyor automation systems for pick-and-pack warehouses, combined with warehouse management software that orchestrates human and robot workflows.",
      whoBuysFromYou:
        "3PL operators and distribution centers with 20,000–500,000 sq ft facilities processing 500+ orders per day. Typically funded by PE or growing at 30%+ YoY.",
      whyChooseYou:
        "Pay-per-pick pricing model with no upfront CapEx, 6-week deployment timeline, and guaranteed 40% throughput increase or robots removed at no charge.",
      avgDealSize: "$80,000 – $600,000 ARR",
      salesCycleLength: "2–6 months",
      distributionModel: ["direct", "var", "integrator"],
      lookingFor: [
        "Material handling equipment dealers",
        "WMS and ERP resellers with 3PL clients",
        "Supply chain consulting firms",
        "Fulfillment center fit-out contractors",
      ],
    },
  },

  elephant: {
    id: "elephant",
    label: "Elephant",
    emoji: "🐘",
    color: "#3b82f6",
    description: "Enterprise Supply Chain Platform",
    brand: {
      companyName: "Meridian SCS",
      tagline: "End-to-end supply chain, one platform",
      primaryColor: "#3b82f6",
      logoDataUrl: "",
    },
    businessProfile: {
      companyName: "Meridian SCS",
      websiteUrl: "meridianscs.com",
      whatYouSell:
        "Enterprise supply chain management platform covering procurement, inventory, logistics, and supplier collaboration — with AI-driven demand planning and risk alerting built in.",
      whoBuysFromYou:
        "VP Supply Chain and COO at manufacturers and distributors with $50M–$2B in revenue, complex multi-site operations, and existing SAP, Oracle, or JD Edwards investments that need a supply chain layer.",
      whyChooseYou:
        "Deep integration with SAP S/4HANA and Oracle ERP, ISO 27001 certified, SOC 2 Type II compliant, dedicated customer success manager, and 98.9% uptime SLA.",
      avgDealSize: "$150,000 – $2,000,000 ARR",
      salesCycleLength: "6–18 months",
      distributionModel: ["direct", "si", "var"],
      lookingFor: [
        "SAP and Oracle system integrators with supply chain practices",
        "Big 4 consulting firms with manufacturing clients",
        "Industry-specific VARs in pharma, food & bev, and automotive",
      ],
    },
  },

  giraffe: {
    id: "giraffe",
    label: "Giraffe",
    emoji: "🦒",
    color: "#f59e0b",
    description: "Last-Mile Delivery Intelligence",
    brand: {
      companyName: "HorizonLast",
      tagline: "Visibility from warehouse to doorstep",
      primaryColor: "#f59e0b",
      logoDataUrl: "",
    },
    businessProfile: {
      companyName: "HorizonLast",
      websiteUrl: "horizonlast.com",
      whatYouSell:
        "Last-mile delivery orchestration platform with real-time driver tracking, automated customer notifications, proof-of-delivery capture, and delivery analytics for regional and national carriers.",
      whoBuysFromYou:
        "Operations managers at regional delivery companies, grocery chains with own delivery fleets, furniture retailers, and distributors running 50–5,000 daily deliveries.",
      whyChooseYou:
        "White-label customer tracking portal included, integrates with 15 TMS platforms, reduces failed deliveries by an average of 34%, and offers per-delivery pricing with no minimums.",
      avgDealSize: "$1,200 – $120,000 ARR",
      salesCycleLength: "1–4 weeks",
      distributionModel: ["var", "referral", "marketplace"],
      lookingFor: [
        "Transportation management software (TMS) resellers",
        "Fleet management and telematics VARs",
        "E-commerce platform integrators",
        "Logistics consulting firms",
      ],
    },
  },
};

module.exports = { DEMO_ACCOUNTS };
