import { createInvitationStudioServer } from "./invitation-studio-server.mjs";

const port = Number(process.env.INVITATION_STUDIO_PORT || 4188);
const server = createInvitationStudioServer({
  dataDir: process.env.INVITATION_STUDIO_DATA_DIR || undefined,
});
server.listen(port, "127.0.0.1", () => console.log(`[Invitation Jukebox] http://127.0.0.1:${port}/invitation-studio/`));
