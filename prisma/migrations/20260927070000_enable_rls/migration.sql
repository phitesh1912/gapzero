-- Supabase exposes the public schema through its REST API using a publishable key.
-- Enable Row Level Security with no policies so that API gets nothing. The app connects as the
-- table owner (which bypasses RLS), and all access control lives in the app's server-side checks.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Medication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prescription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LabResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pharmacy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefillRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Protocol" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Decision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutboundMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
