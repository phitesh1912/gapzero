import type { RefillState } from "@prisma/client";

// Plain-language, non-clinical status for the patient (tracking page and SMS).
// Never includes drug names, doses, labs or other clinical details.

export type PatientStatus = {
  step: 1 | 2 | 3 | 4; // received → reviewing → at pharmacy → ready
  headline: string;
  next: string;
  eta: string | null;
  needsPatientAction: boolean;
};

export function patientStatus(state: RefillState): PatientStatus {
  switch (state) {
    case "RECEIVED":
    case "NEEDS_MATCH":
      return { step: 1, headline: "We got your refill request", next: "Our team is matching it to your chart.", eta: "Usually within 1 business day", needsPatientAction: false };
    case "WAITING_INFO":
      return { step: 1, headline: "We're getting a few details from your pharmacy", next: "No action needed from you right now.", eta: "Usually 1–2 business days", needsPatientAction: false };
    case "WAITING_PRIOR_AUTH":
      return { step: 2, headline: "Waiting on your insurance", next: "Your insurance needs to approve this refill. We've sent them the paperwork.", eta: "Usually 2–5 business days", needsPatientAction: false };
    case "READY_FOR_COSIGN":
    case "READY_FOR_PROVIDER":
      return { step: 2, headline: "Your care team is reviewing your refill", next: "A nurse or your provider will review it shortly.", eta: "Usually within 1 business day", needsPatientAction: false };
    case "WAITING_LABS":
      return { step: 2, headline: "Lab work needed", next: "Please get your lab work done. We'll review your refill as soon as results arrive.", eta: null, needsPatientAction: true };
    case "WAITING_VISIT":
      return { step: 2, headline: "Time for a check-up", next: "Please call the clinic to book a visit. Your provider needs to see you before renewing.", eta: null, needsPatientAction: true };
    case "APPROVED":
    case "SENT_TO_PHARMACY":
    case "SEND_FAILED":
      return { step: 3, headline: "Approved! Sending to your pharmacy", next: "We're sending your prescription to your pharmacy.", eta: "Usually within a few hours", needsPatientAction: false };
    case "PHARMACY_CONFIRMED":
      return { step: 3, headline: "Your pharmacy has your prescription", next: "Your pharmacy is preparing it. They'll let you know when it's ready.", eta: "Usually same or next day", needsPatientAction: false };
    case "FILLED":
    case "CLOSED":
      return { step: 4, headline: "Your refill is ready", next: "Your pharmacy has filled your prescription.", eta: null, needsPatientAction: false };
    case "DENIED":
      return { step: 2, headline: "Your care team needs to talk with you", next: "Please call the clinic so we can discuss next steps.", eta: null, needsPatientAction: true };
  }
}

export function smsText(firstName: string, state: RefillState, trackingUrl: string): string {
  const s = patientStatus(state);
  return `Hi ${firstName}, update on your refill: ${s.headline}. ${s.next} Track it here: ${trackingUrl}`;
}
