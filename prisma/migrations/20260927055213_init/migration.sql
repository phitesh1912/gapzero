-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PROVIDER', 'NURSE', 'FRONT_DESK', 'ADMIN');

-- CreateEnum
CREATE TYPE "LabTest" AS ENUM ('A1C', 'BMP', 'LIPID', 'TSH');

-- CreateEnum
CREATE TYPE "PharmacyStatus" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "RefillSource" AS ENUM ('ERX_RENEWAL', 'FAX', 'PORTAL', 'PHONE', 'PROACTIVE');

-- CreateEnum
CREATE TYPE "RefillState" AS ENUM ('RECEIVED', 'NEEDS_MATCH', 'WAITING_INFO', 'WAITING_PRIOR_AUTH', 'READY_FOR_COSIGN', 'READY_FOR_PROVIDER', 'APPROVED', 'DENIED', 'WAITING_VISIT', 'WAITING_LABS', 'SENT_TO_PHARMACY', 'SEND_FAILED', 'PHARMACY_CONFIRMED', 'FILLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WaitingOn" AS ENUM ('PROVIDER', 'NURSE', 'PHARMACY', 'PATIENT', 'PAYER', 'SYSTEM', 'NONE');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('DRAFT', 'SIGNED', 'RETIRED');

-- CreateEnum
CREATE TYPE "DecisionAction" AS ENUM ('APPROVE', 'APPROVE_BRIDGE', 'DENY', 'REQUIRE_VISIT', 'REQUEST_LABS');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('ERX', 'SMS', 'FAX');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'CONFIRMED', 'FAILED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'AI');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "mrn" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "phone" TEXT NOT NULL,
    "primaryProviderId" TEXT NOT NULL,
    "lastVisitAt" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "drugClass" TEXT NOT NULL,
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "prescriberId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "sig" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "daysSupply" INTEGER NOT NULL,
    "refillsRemaining" INTEGER NOT NULL,
    "writtenAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastFillAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "testCode" "LabTest" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "resultedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pharmacy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ncpdpId" TEXT NOT NULL,
    "status" "PharmacyStatus" NOT NULL DEFAULT 'UP',

    CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefillRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "prescriptionId" TEXT,
    "source" "RefillSource" NOT NULL,
    "rawText" TEXT,
    "documentUrl" TEXT,
    "extracted" JSONB,
    "extractionConfidence" DOUBLE PRECISION,
    "state" "RefillState" NOT NULL DEFAULT 'RECEIVED',
    "blockers" TEXT[],
    "waitingOn" "WaitingOn" NOT NULL DEFAULT 'SYSTEM',
    "protocolId" TEXT,
    "protocolVersion" INTEGER,
    "aiSummary" TEXT,
    "trackingToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "RefillRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "plainEnglish" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "status" "ProtocolStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "refillRequestId" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "action" "DecisionAction" NOT NULL,
    "quantityDays" INTEGER,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "refillRequestId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "target" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "refillRequestId" TEXT,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "fromState" "RefillState",
    "toState" "RefillState",
    "reason" TEXT NOT NULL,
    "ruleRef" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_mrn_key" ON "Patient"("mrn");

-- CreateIndex
CREATE INDEX "LabResult_patientId_testCode_idx" ON "LabResult"("patientId", "testCode");

-- CreateIndex
CREATE UNIQUE INDEX "Pharmacy_ncpdpId_key" ON "Pharmacy"("ncpdpId");

-- CreateIndex
CREATE UNIQUE INDEX "RefillRequest_trackingToken_key" ON "RefillRequest"("trackingToken");

-- CreateIndex
CREATE INDEX "RefillRequest_state_idx" ON "RefillRequest"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Protocol_key_version_key" ON "Protocol"("key", "version");

-- CreateIndex
CREATE INDEX "OutboundMessage_status_nextRetryAt_idx" ON "OutboundMessage"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "Event_refillRequestId_createdAt_idx" ON "Event"("refillRequestId", "createdAt");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_primaryProviderId_fkey" FOREIGN KEY ("primaryProviderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_prescriberId_fkey" FOREIGN KEY ("prescriberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefillRequest" ADD CONSTRAINT "RefillRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefillRequest" ADD CONSTRAINT "RefillRequest_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefillRequest" ADD CONSTRAINT "RefillRequest_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_refillRequestId_fkey" FOREIGN KEY ("refillRequestId") REFERENCES "RefillRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_refillRequestId_fkey" FOREIGN KEY ("refillRequestId") REFERENCES "RefillRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_refillRequestId_fkey" FOREIGN KEY ("refillRequestId") REFERENCES "RefillRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
