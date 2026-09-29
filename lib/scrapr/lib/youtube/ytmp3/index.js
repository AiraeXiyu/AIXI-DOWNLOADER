const axios = require("axios");

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yt.chocolatemoo53.com",
  "https://invidious.tiekoetter.com",
];

function extractVideoId(url) {
  try {
    const parsed = new URL(url);

    if (
      parsed.hostname === "youtu.be" ||
      parsed.hostname.endsWith(".youtu.be")
    ) {
      return parsed.pathname.replace("/", "").split("/")[0] || null;
    }

    if (
      parsed.hostname === "youtube.com" ||
      parsed.hostname.endsWith(".youtube.com")
    ) {
      const v = parsed.searchParams.get("v");
      if (v) return v;

      const parts = parsed.pathname.split("/").filter(Boolean);

      if (
        ["shorts", "embed", "live", "v"].includes(parts[0]) &&
        parts[1]
      ) {
        return parts[1];
      }
    }

    return null;
  } catch {
    const regex =
      /(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/i;

    const match = String(url).match(regex);
    return match ? match[1] : null;
  }
}

function cleanUrl(url) {
  if (!url || typeof url !== "string") return null;

  return url
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .trim();
}

function getThumbnail(data, videoId) {
  if (Array.isArray(data?.videoThumbnails)) {
    const preferred =
      data.videoThumbnails.find((x) =>
        /maxres|sddefault|hqdefault/i.test(x?.quality || "")
      ) ||
      data.videoThumbnails[data.videoThumbnails.length - 1];

    if (preferred?.url) return preferred.url;
  }

  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function pickVideoStreams(streams) {
  if (!Array.isArray(streams)) return [];

  const valid = streams
    .filter((item) => {
      if (!item || typeof item.url !== "string") return false;

      const type = String(item.type || "").toLowerCase();

      return (
        type.includes("video") ||
        item.container === "mp4" ||
        item.resolution
      );
    })
    .map((item) => ({
      url: cleanUrl(item.url),
      type: "video",
      quality:
        item.qualityLabel ||
        item.quality ||
        item.resolution ||
        "Video",
      container: item.container || "mp4",
      resolution: item.resolution || "",
      bitrate: item.bitrate || "",
    }))
    .filter((item) => item.url);

  /*
   * Buang duplikat URL.
   */
  const seen = new Set();

  return valid.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

async function requestInstance(instance, videoId) {
  const endpoint =
    `${instance}/api/v1/videos/${encodeURIComponent(videoId)}` +
    "?hl=en-US&region=US";

  const response = await axios.get(endpoint, {
    timeout: 12000,
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/131.0.0.0 Safari/537.36",
    },
    validateStatus: (status) => status >= 200 && status < 500,
  });

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = response.data;

  if (!data || typeof data !== "object") {
    throw new Error("Invalid API response");
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

async function scrape(url, format = "mp4") {
  const videoId = extractVideoId(url);

  if (!videoId) {
    return {
      status: false,
      message: "Link YouTube tidak valid.",
    };
  }

  let lastError = "Tidak dapat mengambil stream YouTube.";

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const data = await requestInstance(instance, videoId);

      const title =
        data.title ||
        data.videoTitle ||
        "YouTube Video";

      const thumbnail = getThumbnail(data, videoId);

      /*
       * YouTube video.
       */
      if (format === "mp4") {
        const streams = pickVideoStreams(data.formatStreams);

        if (!streams.length) {
          lastError =
            "Instance berhasil diakses, tetapi tidak menyediakan video stream.";
          continue;
        }

        /*
         * Urutkan resolusi dari yang paling tinggi.
         */
        streams.sort((a, b) => {
          const getHeight = (value) => {
            const match = String(value || "").match(/(\d{3,4})p?/i);
            return match ? Number(match[1]) : 0;
          };

          return getHeight(b.quality) - getHeight(a.quality);
        });

        return {
          status: true,
          result: {
            title,
            thumbnail,
            type: "video",
            downloads: streams.slice(0, 8).map((item, index) => ({
              id: `youtube-${index}`,
              url: item.url,
              type: "video",
              quality: item.quality,
              container: item.container,
              resolution: item.resolution,
              bitrate: item.bitrate,
            })),
          },
        };
      }

      /*
       * MP3/audio.
       *
       * Beberapa instance tidak mengembalikan audio stream
       * melalui endpoint publiknya. Jangan mengarang URL.
       */
      if (format === "mp3") {
        const audioStreams = Array.isArray(data.adaptiveFormats)
          ? data.adaptiveFormats
              .filter((item) => {
                const mime = String(item?.type || "").toLowerCase();

                return (
                  typeof item?.url === "string" &&
                  mime.includes("audio/")
                );
              })
              .map((item) => ({
                url: cleanUrl(item.url),
                type: "audio",
                quality:
                  item.audioQuality ||
                  item.quality ||
                  "Audio",
                bitrate:
                  item.bitrate ||
                  item.averageBitrate ||
                  "",
                container: item.container || "",
              }))
              .filter((item) => item.url)
          : [];

        if (audioStreams.length) {
          const seen = new Set();

          const unique = audioStreams.filter((item) => {
            if (seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
          });

          unique.sort(
            (a, b) =>
              Number(b.bitrate || 0) -
              Number(a.bitrate || 0)
          );

          return {
            status: true,
            result: {
              title,
              thumbnail,
              type: "audio",
              downloads: unique.slice(0, 5).map((item, index) => ({
                id: `youtube-audio-${index}`,
                url: item.url,
                type: "audio",
                quality: item.quality,
                bitrate: item.bitrate,
                container: item.container,
              })),
            },
          };
        }

        lastError =
          "Audio stream YouTube tidak tersedia dari instance saat ini.";
        continue;
      }

      return {
        status: false,
        message: "Format download tidak didukung.",
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Instance YouTube gagal diproses.";

      continue;
    }
  }

  return {
    status: false,
    message:
      `Gagal mengambil media YouTube. ` +
      `Semua sumber fallback tidak memberikan stream. ` +
      `Detail: ${lastError}`,
  };
}

module.exports = {
  scrape,
  extractVideoId,
};
