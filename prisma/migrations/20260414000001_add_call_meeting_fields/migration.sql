-- AddColumn: meetingUrl, roomName, meetingTitle, participantIds to CallSession
ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "meetingUrl" TEXT;
ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "roomName" TEXT;
ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "meetingTitle" TEXT;
ALTER TABLE "CallSession" ADD COLUMN IF NOT EXISTS "participantIds" TEXT;
