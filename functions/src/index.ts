/**
 * Firebase Cloud Functions for PolyDoc Library.
 * Handles bundle generation for video content based on storage events and HTTP requests.
 * 
 * Configuration is centralized in config.ts for modularity and environment-specific settings.
 */

import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { onObjectFinalized, onObjectDeleted } from "firebase-functions/v2/storage";
import { generateBundleLogic } from "./generateBundleLogic";
import { createLanguageFolders as createLanguageFoldersUtil } from "./languageFolderUtils";
import { STORAGE_BUCKET, REGION, MAX_INSTANCES } from "./config";

// Initialize Firebase Admin SDK with the configured storage bucket.
// This ensures all storage operations use the correct bucket across environments.
initializeApp({
  storageBucket: STORAGE_BUCKET,
});

// Define supported languages for folder creation (ISO 639-1 codes)
// Matches workspace folders in the attachment: ar, chn, cze, de, en, esp, fr, hrv, hu, it, pl, ro, rus, sk, tr, ukr
const SUPPORTED_LANGUAGES = [
  'ar', // Arabic
  'zh', // Chinese (maps from 'chn')
  'cs', // Czech (maps from 'cze')
  'de', // German
  'en', // English
  'es', // Spanish (maps from 'esp')
  'fr', // French
  'hr', // Croatian (maps from 'hrv')
  'hu', // Hungarian
  'it', // Italian
  'pl', // Polish
  'ro', // Romanian
  'ru', // Russian (maps from 'rus')
  'sk', // Slovak
  'tr', // Turkish
  'uk', // Ukrainian (maps from 'ukr')
];

// Set global options for function instances to control scaling and resource usage.
// Limits the maximum number of concurrent instances to prevent excessive costs.
setGlobalOptions({ maxInstances: MAX_INSTANCES });

/**
 * HTTP endpoint to manually trigger bundle generation for a specific clinic and department.
 * 
 * @param {import('firebase-functions/v2/https').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * 
 * Query parameters:
 * - clinic: string - The clinic identifier.
 * - department: string - The department identifier.
 * 
 * @returns {Promise<void>} Sends a success or error response.
 */
export const generateBundle = onRequest({ region: REGION }, async (req, res) => {
  // Extract query parameters with fallback to empty string.
  const clinic = (req.query.clinic as string) || "";
  const department = (req.query.department as string) || "";

  // Validate required parameters.
  if (!clinic || !department) {
    res.status(400).send("Missing clinic or department parameters.");
    return;
  }

  try {
    // Log the operation for monitoring.
    console.log(`[HTTP] Generating bundle for ${clinic}/${department}`);
    
    // Generate the bundle and get the path.
    const path = await generateBundleLogic(clinic, department);
    
    // Respond with success.
    res.status(200).send(`bundle.json created at ${path}`);
  } catch (e) {
    // Log errors for debugging.
    console.error("[HTTP] Error generating bundle:", e);
    
    // Respond with error.
    res.status(500).send("Error generating bundle.json");
  }
});

/**
 * Storage trigger that automatically regenerates the bundle when a video or subtitle file is uploaded.
 * 
 * @param {import('firebase-functions/v2/storage').CloudEvent<import('firebase-functions/v2/storage').StorageObjectData>} event - Storage event data.
 * @returns {Promise<void>} Completes when bundle is updated or error is logged.
 */
export const autoGenerateBundle = onObjectFinalized(
  {
    bucket: STORAGE_BUCKET,
    region: REGION,
  },
  async (event) => {
    // Extract the file path from the event.
    const path = event.data.name ?? "";
    
    // Parse clinic and department from the path using regex.
    const m = path.match(/^videos\/([^/]+)\/([^/]+)\//);
    if (!m) return; // Ignore files not matching the expected structure.

    const [, clinic, department] = m;
    
    // Log the trigger for monitoring.
    console.log(`[UPLOAD] ${path} → updating bundle for ${clinic}/${department}`);
    
    try {
      // Regenerate the bundle.
      await generateBundleLogic(clinic, department);
      
      // Confirm success.
      console.log(`[UPLOAD] Bundle updated for ${clinic}/${department}`);
    } catch (e) {
      // Log errors without failing the function.
      console.error("[UPLOAD] Error updating bundle:", e);
    }
  }
);

/**
 * Storage trigger that regenerates the bundle when a video or subtitle file is deleted.
 * This ensures the bundle remains accurate after deletions.
 * 
 * @param {import('firebase-functions/v2/storage').CloudEvent<import('firebase-functions/v2/storage').StorageObjectData>} event - Storage event data.
 * @returns {Promise<void>} Completes when bundle is cleaned or error is logged.
 */
export const cleanupBundle = onObjectDeleted(
  {
    bucket: STORAGE_BUCKET,
    region: REGION,
  },
  async (event) => {
    // Extract the file path from the event.
    const path = event.data.name ?? "";
    
    // Parse clinic and department from the path using regex.
    const m = path.match(/^videos\/([^/]+)\/([^/]+)\//);
    if (!m) return; // Ignore files not matching the expected structure.

    const [, clinic, department] = m;
    
    // Log the trigger for monitoring.
    console.log(`[DELETE] ${path} → cleaning bundle for ${clinic}/${department}`);
    
    try {
      // Regenerate the bundle to reflect deletions.
      await generateBundleLogic(clinic, department);
      
      // Confirm success.
      console.log(`[DELETE] Bundle cleaned for ${clinic}/${department}`);
    } catch (e) {
      // Log errors without failing the function.
      console.error("[DELETE] Error cleaning bundle:", e);
    }
  }
);

/**
 * Storage trigger that creates language folders when a new video path is detected.
 * This ensures language subfolders are available for new videos.
 * 
 * @param {import('firebase-functions/v2/storage').CloudEvent<import('firebase-functions/v2/storage').StorageObjectData>} event - Storage event data.
 * @returns {Promise<void>} Completes when folders are created or error is logged.
 */
export const createLanguageFolders = onObjectFinalized(
  {
    bucket: STORAGE_BUCKET,
    region: REGION,
  },
  async (event) => {
    // Extract the file path from the event.
    const path = event.data.name ?? "";
    
    // Parse clinic, department, and video name from the path using regex.
    const m = path.match(/^videos\/([^/]+)\/([^/]+)\/([^/]+)\//);
    if (!m) return; // Ignore files not matching the expected structure.

    const [, clinic, department, videoName] = m;
    
    // Log the trigger for monitoring.
    console.log(`[LANGUAGE FOLDERS] ${path} → creating folders for ${clinic}/${department}/${videoName}`);
    
    // Call the utility function to create language folders if needed.
    try {
      await createLanguageFoldersUtil(clinic, department, videoName, SUPPORTED_LANGUAGES);
      
      // Confirm success.
      console.log(`[LANGUAGE FOLDERS] Folders created for ${clinic}/${department}/${videoName}`);
    } catch (e) {
      // Log errors without failing the function.
      console.error("[LANGUAGE FOLDERS] Error creating folders:", e);
    }
  }
);