import * as dotenv from "dotenv";
import * as functions from "firebase-functions";

dotenv.config(); // load .env in local development (harmless in production)

// Try to read Firebase runtime config safely
let fc: any = {};
try {
  // functions.config() may be undefined in some contexts — guard it
  fc = (functions && (functions.config as any) && functions.config()) || {};
} catch (err) {
  // swallow — we don't want a thrown error during module import
  fc = {};
}

/**
 * Resolve order: process.env (local .env) -> firebase functions config -> default
 */
export const STORAGE_BUCKET: string =
  process.env.STORAGE_BUCKET ||
  fc.polydoc?.storage_bucket ||
  "polydoc-lib.firebasestorage.app";

export const REGION: string =
  process.env.REGION || fc.polydoc?.region || "europe-west1";

export const MAX_INSTANCES: number = Number(
  process.env.MAX_INSTANCES || fc.polydoc?.max_instances || 10
);