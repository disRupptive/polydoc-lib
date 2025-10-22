// ...existing code...
import { getStorage } from "firebase-admin/storage";

/**
 * Automatically creates language folders when a new video directory is detected.
 * Triggers when files are uploaded to paths like videos/default/ophthalmology/BunterStar/
 * and creates subfolders for predefined languages (ISO 639-1 codes).
 */
export async function createLanguageFolders(
  clinic: string,
  department: string,
  videoName: string,
  // Default languages: ISO 639-1 codes (converted from the workspace folder names)
  languages: string[] = [
    "ar", // Arabic
    "zh", // Chinese (was 'chn')
    "cs", // Czech (was 'cze')
    "de", // German
    "en", // English
    "es", // Spanish (was 'esp')
    "fr", // French
    "hr", // Croatian (was 'hrv')
    "hu", // Hungarian
    "it", // Italian
    "pl", // Polish
    "ro", // Romanian
    "ru", // Russian (was 'rus')
    "sk", // Slovak
    "tr", // Turkish
    "uk", // Ukrainian (was 'ukr')
  ]
): Promise<void> {
  const bucket = getStorage().bucket();

  // Basic normalization / guards
  const name = (videoName || "").trim();
  if (!name) {
    console.warn("[LANG-SETUP] empty videoName, skipping");
    return;
  }

  console.log(`[LANG-SETUP] Setting up language folders for: ${clinic}/${department}/${name}`);

  try {
    const createdFolders: string[] = [];

    for (const lang of languages) {
      const langFolderPath = `videos/${clinic}/${department}/${name}/${lang}/`;
      const placeholderPath = `${langFolderPath}.placeholder`;

      // Check if language folder already exists
      const [existingFiles] = await bucket.getFiles({
        prefix: langFolderPath,
        maxResults: 1,
      });

      if (existingFiles.length === 0) {
        // Create placeholder file to establish folder structure
        await bucket.file(placeholderPath).save("", {
          metadata: {
            contentType: "text/plain",
            customMetadata: {
              purpose: "language-folder-structure",
              videoName: name,
              language: lang,
              createdAt: new Date().toISOString(),
            },
          },
        });

        createdFolders.push(lang);
        console.log(`[LANG-SETUP] Created folder: ${langFolderPath}`);
      }
    }

    if (createdFolders.length > 0) {
      console.log(
        `[LANG-SETUP] Successfully created ${createdFolders.length} language folders for "${name}": ${createdFolders.join(
          ", "
        )}`
      );
    } else {
      console.log(`[LANG-SETUP] All language folders already exist for "${name}"`);
    }
  } catch (error) {
    console.error(`[LANG-SETUP] Error creating language folders for "${name}":`, error);
    throw error;
  }
}
// ...existing code...