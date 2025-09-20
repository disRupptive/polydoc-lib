import { getStorage } from "firebase-admin/storage";

interface Bundle {
  version: string;
  clinic: string;
  department: string;
  videos: {
    id: string;
    title: string;
    languages: {
      [langCode: string]: {
        videoPath: string;
        subtitlePath: string;
      };
    };
  }[];
}

/** Scans videos/<clinic>/<department>/** and writes bundles/<clinic>/<department>/bundle.json */
export async function generateBundleLogic(
  clinic: string,
  department: string
): Promise<string> {
  const bucket = getStorage().bucket();
  const prefix = `videos/${clinic}/${department}/`;
  const [files] = await bucket.getFiles({ prefix });

  const videoMap = new Map<string, Map<string, { videoPath: string; subtitlePath: string }>>();

  for (const file of files) {
    const filePath = file.name;

    // Only consider videos/subtitles
    if (!filePath.endsWith(".mp4") && !filePath.endsWith(".vtt")) continue;

    // videos/<clinic>/<department>/<videoId>/<lang>/<filename>.(mp4|vtt)
    const match = filePath.match(
      /^videos\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/[^/]+\.(mp4|vtt)$/
    );
    if (!match) continue;

    const [, fileClinic, fileDept, videoId, lang, ext] = match;
    if (fileClinic !== clinic || fileDept !== department) continue;

    if (!videoMap.has(videoId)) videoMap.set(videoId, new Map());
    const langMap = videoMap.get(videoId)!;

    if (!langMap.has(lang)) langMap.set(lang, { videoPath: "", subtitlePath: "" });
    const langEntry = langMap.get(lang)!;

    if (ext === "mp4") langEntry.videoPath = filePath;
    else langEntry.subtitlePath = filePath;
  }

  const videos: Bundle["videos"] = [];
  for (const [videoId, langMap] of videoMap.entries()) {
    const languages: Bundle["videos"][number]["languages"] = {};
    for (const [lang, paths] of langMap.entries()) {
      languages[lang] = {
        videoPath: paths.videoPath,
        subtitlePath: paths.subtitlePath,
      };
    }
    videos.push({ id: videoId, title: videoId, languages });
  }

  const bundle: Bundle = { version: "1.0", clinic, department, videos };
  const bundleJson = JSON.stringify(bundle, null, 2);
  const bundlePath = `bundles/${clinic}/${department}/bundle.json`;

  await bucket.file(bundlePath).save(bundleJson, {
    contentType: "application/json",
    resumable: false,
  });

  return bundlePath;
}
