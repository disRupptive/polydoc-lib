import * as functions from "firebase-functions";
import * as dotenv from "dotenv";

dotenv.config(); // Lädt .env beim lokalen Entwickeln

const fc = (functions && (functions.config as any) && functions.config()) || {};

// Priorität: process.env (aus .env) -> firebase functions config -> default
export const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET ||
  fc.polydoc?.storage_bucket ||
  "polydoc-lib.firebasestorage.app";

export const REGION =
  process.env.REGION || fc.polydoc?.region || "europe-west1";

export const MAX_INSTANCES = Number(
  process.env.MAX_INSTANCES || fc.polydoc?.max_instances || 10
);