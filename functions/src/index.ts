import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { onObjectFinalized, onObjectDeleted } from "firebase-functions/v2/storage";
import { generateBundleLogic } from "./generateBundleLogic";

// Init Admin SDK with YOUR bucket
initializeApp({
  storageBucket: "polydoc-lib.firebasestorage.app",
});

// Global limits
setGlobalOptions({ maxInstances: 10 });

/** HTTP: Manually trigger bundle generation
 *  GET /generateBundle?clinic=...&department=...
 */
export const generateBundle = onRequest({ region: "europe-west1" }, async (req, res) => {
  const clinic = (req.query.clinic as string) || "";
  const department = (req.query.department as string) || "";

  if (!clinic || !department) {
    res.status(400).send("Missing clinic or department parameters.");
    return;
  }

  try {
    console.log(`[HTTP] Generating bundle for ${clinic}/${department}`);
    const path = await generateBundleLogic(clinic, department);
    res.status(200).send(`bundle.json created at ${path}`);
  } catch (e) {
    console.error("[HTTP] Error generating bundle:", e);
    res.status(500).send("Error generating bundle.json");
  }
});

/** Storage Trigger: on upload → refresh bundle */
export const autoGenerateBundle = onObjectFinalized(
  {
    bucket: "polydoc-lib.firebasestorage.app",
    region: "europe-west1",
  },
  async (event) => {
    const path = event.data.name ?? "";
    const m = path.match(/^videos\/([^/]+)\/([^/]+)\//);
    if (!m) return;

    const [, clinic, department] = m;
    console.log(`[UPLOAD] ${path} → updating bundle for ${clinic}/${department}`);
    try {
      await generateBundleLogic(clinic, department);
      console.log(`[UPLOAD] Bundle updated for ${clinic}/${department}`);
    } catch (e) {
      console.error("[UPLOAD] Error updating bundle:", e);
    }
  }
);

/** Storage Trigger: on delete → refresh bundle */
export const cleanupBundle = onObjectDeleted(
  {
    bucket: "polydoc-lib.firebasestorage.app",
    region: "europe-west1",
  },
  async (event) => {
    const path = event.data.name ?? "";
    const m = path.match(/^videos\/([^/]+)\/([^/]+)\//);
    if (!m) return;

    const [, clinic, department] = m;
    console.log(`[DELETE] ${path} → cleaning bundle for ${clinic}/${department}`);
    try {
      await generateBundleLogic(clinic, department);
      console.log(`[DELETE] Bundle cleaned for ${clinic}/${department}`);
    } catch (e) {
      console.error("[DELETE] Error cleaning bundle:", e);
    }
  }
);
