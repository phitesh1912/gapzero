import { db } from "../db";

// Pharmacy integration boundary. Production: NCPDP SCRIPT NewRx/RxRenewalResponse over the
// e-prescribing network. Here: a mock that fails when the pharmacy is toggled DOWN on /ops.

export type ErxPayload = {
  patientName: string;
  medication: string;
  sig: string;
  daysSupply: number;
  prescriber: string;
};

export type SendResult = { messageRef: string; receiptConfirmed: boolean };

export interface PharmacyAdapter {
  sendRx(pharmacyId: string, payload: ErxPayload): Promise<SendResult>;
  // Fill notification from the pharmacy (in production, an RxFill message or fill-history feed).
  checkFill(pharmacyId: string, messageRef: string): Promise<{ filled: boolean }>;
}

export class PharmacyUnavailableError extends Error {
  constructor(pharmacyName: string) {
    super(`${pharmacyName} is not responding (connection timeout)`);
    this.name = "PharmacyUnavailableError";
  }
}

export const mockPharmacy: PharmacyAdapter = {
  async sendRx(pharmacyId) {
    const pharmacy = await db.pharmacy.findUniqueOrThrow({ where: { id: pharmacyId } });
    if (pharmacy.status === "DOWN") throw new PharmacyUnavailableError(pharmacy.name);
    return { messageRef: `erx_${Date.now().toString(36)}`, receiptConfirmed: true };
  },
  async checkFill(pharmacyId) {
    const pharmacy = await db.pharmacy.findUniqueOrThrow({ where: { id: pharmacyId } });
    if (pharmacy.status === "DOWN") throw new PharmacyUnavailableError(pharmacy.name);
    return { filled: true };
  },
};

export const pharmacyAdapter: PharmacyAdapter = mockPharmacy;
