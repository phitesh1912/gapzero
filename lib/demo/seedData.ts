import type { LabTest, RefillSource, RefillState } from "@prisma/client";

// Synthetic demo data (CLAUDE.md section 14). Every name, MRN and phone number here is made up.
// Times are expressed relative to "today" so the demo looks right whenever it runs.

export const USERS = [
  { id: "usr_rao", name: "Dr. Asha Rao", role: "PROVIDER" },
  { id: "usr_chen", name: "Dr. Michael Chen", role: "PROVIDER" },
  { id: "usr_bennett", name: "Dr. Laura Bennett", role: "PROVIDER" },
  { id: "usr_nair", name: "Priya Nair, RN", role: "NURSE" },
  { id: "usr_okafor", name: "James Okafor, RN", role: "NURSE" },
  { id: "usr_lee", name: "Sam Lee", role: "FRONT_DESK" },
  { id: "usr_ortiz", name: "Dana Ortiz", role: "ADMIN" },
] as const;

export const PROVIDER_IDS = ["usr_rao", "usr_chen", "usr_bennett"] as const;
export const NURSE_IDS = ["usr_nair", "usr_okafor"] as const;

export const PHARMACIES = [
  { id: "phm_main", name: "Main Street Pharmacy", ncpdpId: "0000001" },
  { id: "phm_river", name: "Riverside Drug", ncpdpId: "0000002" },
  // The one that gets toggled down in the demo.
  { id: "phm_caremart", name: "CareMart Pharmacy #042", ncpdpId: "0000003" },
] as const;
export type PharmacyId = (typeof PHARMACIES)[number]["id"];

export const MEDICATIONS = {
  LISINOPRIL: { id: "med_lisinopril", name: "Lisinopril", strength: "10 mg tablet", drugClass: "ACE_INHIBITOR", sig: "Take 1 tablet by mouth once daily" },
  AMLODIPINE: { id: "med_amlodipine", name: "Amlodipine", strength: "5 mg tablet", drugClass: "CCB", sig: "Take 1 tablet by mouth once daily" },
  LOSARTAN: { id: "med_losartan", name: "Losartan", strength: "50 mg tablet", drugClass: "ARB", sig: "Take 1 tablet by mouth once daily" },
  METFORMIN: { id: "med_metformin", name: "Metformin", strength: "1000 mg tablet", drugClass: "BIGUANIDE", sig: "Take 1 tablet by mouth twice daily with meals" },
  ATORVASTATIN: { id: "med_atorvastatin", name: "Atorvastatin", strength: "40 mg tablet", drugClass: "STATIN", sig: "Take 1 tablet by mouth at bedtime" },
  LEVOTHYROXINE: { id: "med_levothyroxine", name: "Levothyroxine", strength: "75 mcg tablet", drugClass: "THYROID", sig: "Take 1 tablet by mouth every morning on an empty stomach" },
  SERTRALINE: { id: "med_sertraline", name: "Sertraline", strength: "50 mg tablet", drugClass: "SSRI", sig: "Take 1 tablet by mouth once daily" },
  METHYLPHENIDATE: {
    id: "med_methylphenidate",
    name: "Methylphenidate ER",
    strength: "20 mg tablet",
    drugClass: "STIMULANT",
    sig: "Take 1 tablet by mouth every morning",
    isControlled: true,
    schedule: "C-II",
  },
} as const;
export type MedKey = keyof typeof MEDICATIONS;

// Protocols (CLAUDE.md section 8). All four signed at v1 by Dr. Rao; one draft.
export const PROTOCOLS = [
  {
    key: "hypertension",
    name: "Hypertension Protocol",
    status: "SIGNED",
    plainEnglish:
      "Nurses may renew ACE inhibitors, ARBs, calcium channel blockers and thiazides for up to 90 days if the patient was seen in the last 12 months, has a BMP in the last 12 months, and no dose change is requested.",
    rules: {
      appliesTo: { drugClasses: ["ACE_INHIBITOR", "ARB", "CCB", "THIAZIDE"] },
      conditions: [
        { fact: "daysSinceLastVisit", op: "<=", value: 365, label: "Seen within 12 months" },
        { fact: "daysSinceLab:BMP", op: "<=", value: 365, label: "BMP within 12 months" },
        { fact: "doseChangeRequested", op: "==", value: false, label: "No dose change requested" },
      ],
      maxDaysSupply: 90,
    },
  },
  {
    key: "diabetes-metformin",
    name: "Diabetes (Metformin) Protocol",
    status: "SIGNED",
    plainEnglish:
      "Nurses may renew metformin for up to 90 days if the patient was seen in the last 12 months, has an A1C in the last 6 months, and no dose change is requested.",
    rules: {
      appliesTo: { drugClasses: ["BIGUANIDE"] },
      conditions: [
        { fact: "daysSinceLastVisit", op: "<=", value: 365, label: "Seen within 12 months" },
        { fact: "daysSinceLab:A1C", op: "<=", value: 180, label: "A1C within 6 months" },
        { fact: "doseChangeRequested", op: "==", value: false, label: "No dose change requested" },
      ],
      maxDaysSupply: 90,
    },
  },
  {
    key: "statin",
    name: "Statin Protocol",
    status: "SIGNED",
    plainEnglish:
      "Nurses may renew statins for up to 90 days if the patient was seen in the last 12 months, has a lipid panel in the last 12 months, and no dose change is requested.",
    rules: {
      appliesTo: { drugClasses: ["STATIN"] },
      conditions: [
        { fact: "daysSinceLastVisit", op: "<=", value: 365, label: "Seen within 12 months" },
        { fact: "daysSinceLab:LIPID", op: "<=", value: 365, label: "Lipid panel within 12 months" },
        { fact: "doseChangeRequested", op: "==", value: false, label: "No dose change requested" },
      ],
      maxDaysSupply: 90,
    },
  },
  {
    key: "thyroid",
    name: "Thyroid Protocol",
    status: "SIGNED",
    plainEnglish:
      "Nurses may renew levothyroxine for up to 90 days if the patient was seen in the last 12 months, has a TSH in the last 12 months, and no dose change is requested.",
    rules: {
      appliesTo: { drugClasses: ["THYROID"] },
      conditions: [
        { fact: "daysSinceLastVisit", op: "<=", value: 365, label: "Seen within 12 months" },
        { fact: "daysSinceLab:TSH", op: "<=", value: 365, label: "TSH within 12 months" },
        { fact: "doseChangeRequested", op: "==", value: false, label: "No dose change requested" },
      ],
      maxDaysSupply: 90,
    },
  },
  {
    key: "ssri",
    name: "Antidepressant (SSRI) Protocol",
    status: "DRAFT",
    plainEnglish:
      "Nurses may renew SSRIs for up to 30 days if the patient was seen in the last 6 months and no dose change is requested.",
    rules: {
      appliesTo: { drugClasses: ["SSRI"] },
      conditions: [
        { fact: "daysSinceLastVisit", op: "<=", value: 180, label: "Seen within 6 months" },
        { fact: "doseChangeRequested", op: "==", value: false, label: "No dose change requested" },
      ],
      maxDaysSupply: 30,
    },
  },
] as const;

// States a request moves through after triage. The first entry implies the human decision.
export type PathState = Exclude<RefillState, "RECEIVED" | "NEEDS_MATCH" | "WAITING_INFO" | "WAITING_PRIOR_AUTH" | "READY_FOR_COSIGN" | "READY_FOR_PROVIDER">;

export type RequestSpec = {
  source: RefillSource;
  ageDays: number; // how long ago the request came in
  triage?: boolean; // false = still RECEIVED (just arrived)
  expect?: RefillState; // triage result the seed asserts
  path?: PathState[];
  bridgeDays?: number; // provider approves a bridge supply (and orders labs) in one action
  flags?: { priorAuthRequired?: boolean; infoMissing?: boolean; doseChangeRequested?: boolean };
  rawText?: string;
};

export type RxSpec = {
  med: MedKey;
  daysLeft: number;
  refills: number;
  daysSupply?: number;
  expiresInDays?: number; // negative = expired
  pharmacy?: PharmacyId;
  requests?: RequestSpec[];
};

export type PatientSpec = {
  first: string;
  last: string;
  dob: string; // YYYY-MM-DD
  visitDaysAgo: number | null;
  labs?: Partial<Record<LabTest, number>>; // days ago
  rx: RxSpec[];
};

const CLOSED_PATH: PathState[] = ["APPROVED", "SENT_TO_PHARMACY", "PHARMACY_CONFIRMED", "FILLED", "CLOSED"];

export const PATIENTS: PatientSpec[] = [
  // At risk #1 and the "messy fax" demo patient: no refills, A1C overdue, no open request yet.
  {
    first: "Rosa", last: "Delgado", dob: "1961-04-12", visitDaysAgo: 200, labs: { A1C: 240, BMP: 300 },
    rx: [
      { med: "METFORMIN", daysLeft: 6, refills: 0, pharmacy: "phm_main" },
      { med: "LISINOPRIL", daysLeft: 40, refills: 3, daysSupply: 90, requests: [{ source: "ERX_RENEWAL", ageDays: 55, path: CLOSED_PATH }] },
    ],
  },
  {
    first: "Walter", last: "Kim", dob: "1955-08-03", visitDaysAgo: 90, labs: { BMP: 100, LIPID: 120 },
    rx: [
      { med: "LISINOPRIL", daysLeft: 2, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 1.2, expect: "READY_FOR_COSIGN" }] },
      { med: "ATORVASTATIN", daysLeft: 50, refills: 2, daysSupply: 90 },
    ],
  },
  // At risk #2: thyroid, visit and TSH overdue.
  {
    first: "Aisha", last: "Patel", dob: "1972-11-21", visitDaysAgo: 400, labs: { TSH: 420 },
    rx: [{ med: "LEVOTHYROXINE", daysLeft: 4, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 95, path: CLOSED_PATH }] }],
  },
  // At risk #3 and the "clean fax" demo patient.
  {
    first: "George", last: "Miller", dob: "1948-02-14", visitDaysAgo: 60, labs: { BMP: 60, LIPID: 60 },
    rx: [{ med: "AMLODIPINE", daysLeft: 7, refills: 0, pharmacy: "phm_river" }],
  },
  {
    first: "Linda", last: "Nguyen", dob: "1966-06-30", visitDaysAgo: 150, labs: { A1C: 90 },
    rx: [{
      med: "METFORMIN", daysLeft: -3, refills: 0,
      requests: [
        { source: "PORTAL", ageDays: 2.5, expect: "READY_FOR_COSIGN", rawText: "Hi, I ran out of my metformin on Wednesday. Can you send a refill to my pharmacy? Thanks, Linda" },
        { source: "ERX_RENEWAL", ageDays: 34, path: CLOSED_PATH },
      ],
    }],
  },
  // Controlled-substance demo: must go to the provider no matter what.
  {
    first: "Marcus", last: "Johnson", dob: "1990-01-09", visitDaysAgo: 100,
    rx: [{
      med: "METHYLPHENIDATE", daysLeft: 1, refills: 0, pharmacy: "phm_main",
      requests: [
        { source: "PORTAL", ageDays: 0.8, expect: "READY_FOR_PROVIDER", rawText: "Need my ADHD med refilled please, I have 1 left." },
        { source: "PORTAL", ageDays: 45, path: ["DENIED", "CLOSED"], rawText: "Can I pick up my methylphenidate early? Traveling next week." },
      ],
    }],
  },
  {
    first: "Evelyn", last: "Brooks", dob: "1952-09-17", visitDaysAgo: 500, labs: { BMP: 500 },
    rx: [{ med: "LOSARTAN", daysLeft: -6, refills: 0, expiresInDays: -30, requests: [{ source: "FAX", ageDays: 4, expect: "READY_FOR_PROVIDER" }] }],
  },
  {
    first: "Daniel", last: "Reyes", dob: "1979-03-05", visitDaysAgo: 30, labs: { LIPID: 400 },
    rx: [{ med: "ATORVASTATIN", daysLeft: 3, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 1.5, expect: "READY_FOR_PROVIDER" }] }],
  },
  {
    first: "Grace", last: "Thompson", dob: "1985-12-02", visitDaysAgo: 120,
    rx: [{ med: "SERTRALINE", daysLeft: 5, refills: 0, pharmacy: "phm_caremart", requests: [{ source: "PORTAL", ageDays: 1, expect: "READY_FOR_PROVIDER" }] }],
  },
  {
    first: "Henry", last: "Wilson", dob: "1958-07-22", visitDaysAgo: 80, labs: { BMP: 80 },
    rx: [{
      med: "LISINOPRIL", daysLeft: 12, refills: 0,
      requests: [{
        source: "ERX_RENEWAL", ageDays: 0.5, expect: "READY_FOR_PROVIDER", flags: { doseChangeRequested: true },
        rawText: "Pharmacy note: patient reports home BP readings 150s/90s, asks whether dose should be increased to 20 mg.",
      }],
    }],
  },
  {
    first: "Sofia", last: "Martinez", dob: "1970-10-11", visitDaysAgo: 60, labs: { BMP: 60 },
    rx: [{
      med: "LOSARTAN", daysLeft: 9, refills: 0,
      requests: [{ source: "ERX_RENEWAL", ageDays: 3, expect: "WAITING_PRIOR_AUTH", flags: { priorAuthRequired: true }, rawText: "Plan requires prior authorization for losartan 50 mg (non-preferred)." }],
    }],
  },
  {
    first: "Robert", last: "Chen", dob: "1962-05-28", visitDaysAgo: 200, labs: { TSH: 100 },
    rx: [{
      med: "LEVOTHYROXINE", daysLeft: 7, refills: 0,
      requests: [{ source: "ERX_RENEWAL", ageDays: 0.3, expect: "READY_FOR_COSIGN" }, { source: "ERX_RENEWAL", ageDays: 70, path: CLOSED_PATH }],
    }],
  },
  {
    first: "Patricia", last: "Adams", dob: "1950-04-19", visitDaysAgo: 45, labs: { BMP: 45, LIPID: 45 },
    rx: [
      { med: "LOSARTAN", daysLeft: 0, refills: 0, requests: [{ source: "PHONE", ageDays: 1.8, expect: "READY_FOR_COSIGN", rawText: "Patient called: out of losartan today, uses Main Street Pharmacy." }] },
      { med: "ATORVASTATIN", daysLeft: 1, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 1.7, expect: "READY_FOR_COSIGN" }] },
    ],
  },
  {
    first: "Kevin", last: "O'Brien", dob: "1983-08-14", visitDaysAgo: 300, labs: { A1C: 300 },
    rx: [{ med: "METFORMIN", daysLeft: -1, refills: 0, requests: [{ source: "FAX", ageDays: 2, expect: "READY_FOR_PROVIDER" }] }],
  },
  {
    first: "Nadia", last: "Hassan", dob: "1975-01-26", visitDaysAgo: 100, labs: { BMP: 100 },
    rx: [{
      med: "LISINOPRIL", daysLeft: 11, refills: 0,
      requests: [{ source: "FAX", ageDays: 2.2, expect: "WAITING_INFO", flags: { infoMissing: true }, rawText: "Refill request: Nadia Hassan, lisinopril. Strength and quantity illegible." }],
    }],
  },
  {
    first: "Thomas", last: "Wright", dob: "1957-06-08", visitDaysAgo: 30, labs: { TSH: 30 },
    rx: [{ med: "LEVOTHYROXINE", daysLeft: 5, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 1, path: ["APPROVED", "SENT_TO_PHARMACY"] }] }],
  },
  // Failed send waiting in the retry queue.
  {
    first: "Olivia", last: "Scott", dob: "1988-03-15", visitDaysAgo: 90,
    rx: [{ med: "SERTRALINE", daysLeft: 2, refills: 0, pharmacy: "phm_caremart", requests: [{ source: "PORTAL", ageDays: 1.4, path: ["APPROVED", "SENT_TO_PHARMACY", "SEND_FAILED"] }] }],
  },
  {
    first: "Benjamin", last: "Clark", dob: "1945-12-30", visitDaysAgo: 50, labs: { BMP: 50 },
    rx: [{ med: "AMLODIPINE", daysLeft: 3, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 1.1, path: ["APPROVED", "SENT_TO_PHARMACY", "PHARMACY_CONFIRMED"] }] }],
  },
  {
    first: "Chloe", last: "Lewis", dob: "1992-07-04", visitDaysAgo: 20, labs: { LIPID: 20 },
    rx: [{ med: "ATORVASTATIN", daysLeft: 88, refills: 3, daysSupply: 90, requests: [{ source: "ERX_RENEWAL", ageDays: 3, path: ["APPROVED", "SENT_TO_PHARMACY", "PHARMACY_CONFIRMED", "FILLED"] }] }],
  },
  // Bridge supply + lab order in one provider action.
  {
    first: "Samuel", last: "Young", dob: "1960-09-09", visitDaysAgo: 330, labs: { A1C: 400 },
    rx: [{ med: "METFORMIN", daysLeft: 4, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 1.3, bridgeDays: 30, path: ["APPROVED", "SENT_TO_PHARMACY", "PHARMACY_CONFIRMED"] }] }],
  },
  {
    first: "Emily", last: "Harris", dob: "1968-02-20", visitDaysAgo: 700, labs: { BMP: 200 },
    rx: [{ med: "LOSARTAN", daysLeft: 6, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 2.6, path: ["WAITING_VISIT"] }] }],
  },
  {
    first: "Jacob", last: "Turner", dob: "1976-11-01", visitDaysAgo: 380, labs: { LIPID: 380 },
    rx: [{ med: "ATORVASTATIN", daysLeft: -2, refills: 0, requests: [{ source: "FAX", ageDays: 3.5, path: ["WAITING_LABS"] }] }],
  },
  {
    first: "Hannah", last: "Walker", dob: "1981-05-13", visitDaysAgo: 100,
    rx: [{
      med: "METHYLPHENIDATE", daysLeft: 14, refills: 0, pharmacy: "phm_river",
      requests: [{ source: "PORTAL", ageDays: 0.9, path: ["DENIED"], rawText: "Lost my prescription bottle, can I get a new fill?" }],
    }],
  },
  {
    first: "Isaac", last: "Hall", dob: "1954-10-25", visitDaysAgo: 90, labs: { BMP: 90, LIPID: 90 },
    rx: [
      { med: "LISINOPRIL", daysLeft: 70, refills: 3, daysSupply: 90, requests: [{ source: "ERX_RENEWAL", ageDays: 22, path: CLOSED_PATH }] },
      { med: "ATORVASTATIN", daysLeft: 80, refills: 3, daysSupply: 90, requests: [{ source: "ERX_RENEWAL", ageDays: 12, path: CLOSED_PATH }] },
    ],
  },
  {
    first: "Zoe", last: "Allen", dob: "1987-08-18", visitDaysAgo: 60, labs: { TSH: 60 },
    rx: [{ med: "LEVOTHYROXINE", daysLeft: 85, refills: 5, daysSupply: 90, requests: [{ source: "PORTAL", ageDays: 7, path: CLOSED_PATH }] }],
  },
  {
    first: "Nathan", last: "King", dob: "1965-03-27", visitDaysAgo: 200, labs: { A1C: 150 },
    rx: [{ med: "METFORMIN", daysLeft: 60, refills: 2, daysSupply: 90, requests: [{ source: "ERX_RENEWAL", ageDays: 31, path: CLOSED_PATH }] }],
  },
  {
    first: "Mia", last: "Green", dob: "1973-12-09", visitDaysAgo: 40, labs: { BMP: 40 },
    rx: [{ med: "LOSARTAN", daysLeft: 15, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 0.6, expect: "READY_FOR_COSIGN" }] }],
  },
  {
    first: "Lucas", last: "Baker", dob: "1959-06-16", visitDaysAgo: 250, labs: { BMP: 250 },
    rx: [
      { med: "LISINOPRIL", daysLeft: 20, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 0.02, triage: false }] },
      { med: "AMLODIPINE", daysLeft: 30, refills: 2 },
    ],
  },
  {
    first: "Ava", last: "Nelson", dob: "1994-02-11", visitDaysAgo: 150,
    rx: [{ med: "SERTRALINE", daysLeft: 8, refills: 0, requests: [{ source: "PORTAL", ageDays: 0.4, path: ["APPROVED"] }] }],
  },
  {
    first: "Ethan", last: "Carter", dob: "1971-09-03", visitDaysAgo: 330, labs: { A1C: 170, BMP: 330 },
    rx: [
      { med: "LOSARTAN", daysLeft: 10, refills: 0, requests: [{ source: "ERX_RENEWAL", ageDays: 4, expect: "WAITING_PRIOR_AUTH", flags: { priorAuthRequired: true } }] },
      { med: "METFORMIN", daysLeft: 45, refills: 1, daysSupply: 90 },
    ],
  },
];

// Requests that couldn't be matched to a patient record.
export const UNMATCHED_REQUESTS: { source: RefillSource; ageDays: number; rawText: string }[] = [
  {
    source: "FAX",
    ageDays: 0.7,
    rawText: "REFILL AUTH REQUEST -- Pt: J. Smyth  DOB 03/??/1970  Lisinopril 20mg #90  Prescriber: Dr Rao  From: Riverside Drug",
  },
  {
    source: "PORTAL",
    ageDays: 1.6,
    rawText: "hi this is Maria, i need a refill on my blood pressure pill, the white one. thank you",
  },
];
