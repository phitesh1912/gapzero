import { db } from "../db";

// EHR boundary. Production: FHIR R4 (Patient, MedicationRequest, Observation, Encounter).
// Here: reads from our own seeded tables.

export type PatientCandidate = { id: string; mrn: string; firstName: string; lastName: string; dob: Date };

export interface EhrAdapter {
  searchPatients(query: { lastName?: string | null; firstName?: string | null; dob?: Date | null }): Promise<PatientCandidate[]>;
}

export const mockEhr: EhrAdapter = {
  async searchPatients({ lastName, firstName, dob }) {
    if (!lastName && !firstName && !dob) return [];
    return db.patient.findMany({
      where: {
        AND: [
          lastName ? { lastName: { equals: lastName, mode: "insensitive" } } : {},
          firstName ? { firstName: { startsWith: firstName.slice(0, 1), mode: "insensitive" } } : {},
          dob ? { dob } : {},
        ],
      },
      select: { id: true, mrn: true, firstName: true, lastName: true, dob: true },
      take: 5,
    });
  },
};

export const ehrAdapter: EhrAdapter = mockEhr;
