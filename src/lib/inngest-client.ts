import { Inngest } from "inngest";
import { getEnv } from "./env";

const env = getEnv();

export const inngest = new Inngest({
  id: "var-hunter",
  signingKey: env.inngestSigningSecret,
  eventKey: env.inngestEventKey,
});
