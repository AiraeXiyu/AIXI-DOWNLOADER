const axios = require("axios");

function extractCleanUrl(text) {
  if (!text || typeof text !== "string") return "";

  const matches = text.match(
    /https?:\/\/[^\s<>"']+/gi
  );

  if (matches && matches.length) {
    const douyinUrl = matches.find((url) =>
      /(?:v\.douyin\.com|www\.douyin\.com|douyin\.com)/i.test(
        url
      )
    );

    const selected = douyinUrl || matches[0];

    return selected
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[)\]}>.,!?，。！？]+$/g, "")
      .trim();
  }

  let clean = text.trim();

  clean = clean.replace(
    /[\u200B-\u200D\uFEFF]/g,
    ""
  );

  if (
    !clean.startsWith("http://") &&
    !clean.startsWith("https://")
  ) {
    clean = "https://" + clean;
  }

  return clean;
}

function extractDouyinItemId(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const match =
    text.match(
      /(?:video|note|share\/(?:video|slides))\b[\/?](\d{15,22})/i
    ) ||
    text.match(
      /modal_id=(\d{15,22})/i
    ) ||
    text.match(
      /group_id=(\d{15,22})/i
    ) ||
    text.match(
      /aweme_id=(\d{15,22})/i
    ) ||
    text.match(
      /\/(\d{18,20})\b/
    );

  return match ? match[1] : null;
}

function parseJSObject(slice) {
  let braceCount = 0;
  let inStr = false;
  let strChar = null;
  let escape = false;
  let endIdx = -1;

  for (
    let i = 0;
    i < slice.length;
    i++
  ) {
    const c = slice[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (c === "\\") {
      escape = true;
      continue;
    }

    if (inStr) {
      if (c === strChar) {
        inStr = false;
      }
      continue;
    }

    if (c === '"' || c === "'") {
      inStr = true;
      strChar = c;
      continue;
    }

    if (c === "{") {
      braceCount++;
    } else if (c === "}") {
      braceCount--;

      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  if (endIdx !== -1) {
    try {
      return JSON.parse(
        slice.substring(0, endIdx)
      );
    } catch (_) {}
  }

  return null;
}

function extractRouterOrSSRData(htmlStr) {
  if (
    !htmlStr ||
    typeof htmlStr !== "string"
  ) {
    return null;
  }

  const markers = [
    "window._ROUTER_DATA =",
    "window._SSR_DATA =",
    "window._RENDER_DATA =",
    "window.__INIT_PROPS__ =",
    "window.SSR_HYDRATED_DATA ="
  ];

  for (const marker of markers) {
    const startIdx =
      htmlStr.indexOf(marker);

    if (startIdx === -1) {
      continue;
    }

    let slice = htmlStr
      .substring(
        startIdx + marker.length
      )
      .trim();

    if (
      slice.startsWith('"') &&
      slice.includes("%7B")
    ) {
      try {
        const matchStr =
          slice.match(/^"([^"]+)"/);

        if (matchStr) {
          slice = decodeURIComponent(
            matchStr[1]
          );
        }
      } catch (_) {}
    } else if (
      slice.startsWith("%7B")
    ) {
      try {
        slice =
          decodeURIComponent(slice);
      } catch (_) {}
    }

    const data =
      parseJSObject(slice);

    if (data) {
      return data;
    }
  }

  const scriptMatches =
    htmlStr.matchAll(
      /<script[^>]*id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/gi
    );

  for (const m of scriptMatches) {
    try {
      const decoded =
        decodeURIComponent(
          m[1].trim()
        );

      return JSON.parse(decoded);
    } catch (_) {}
  }

  return null;
}

async function fetchDouyinApi(
  itemId,
  cookieHeader = ""
) {
  try {
    const apiUrl =
      `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${itemId}`;

    const res =
      await axios.get(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",

          Referer:
            "https://www.iesdouyin.com/",

          Accept:
            "application/json",

          Cookie:
            cookieHeader
        },

        timeout: 10000
      });

    const data = res.data;

    if (
      data &&
      data.item_list &&
      data.item_list.length > 0
    ) {
      return data.item_list[0];
    }
  } catch (_) {}

  return null;
}

function getItemFromData(data) {
  if (!data) return null;

  const loaderData =
    data.loaderData || {};

  for (const key in loaderData) {
    if (
      loaderData[key] &&
      loaderData[key].videoInfoRes
    ) {
      const itemList =
        loaderData[key]
          .videoInfoRes
          .item_list;

      if (
        itemList &&
        itemList.length > 0
      ) {
        return itemList[0];
      }
    }
  }

  if (
    data.aweme &&
    data.aweme.detail
  ) {
    return data.aweme.detail;
  }

  if (
    data.item_list &&
    data.item_list.length > 0
  ) {
    return data.item_list[0];
  }

  if (data.aweme_detail) {
    return data.aweme_detail;
  }

  return null;
}

function buildResult(item) {
  const title =
    item.desc ||
    item.share_info?.share_desc ||
    "Douyin Content";

  const author =
    item.author?.nickname ||
    "Douyin User";

  const thumbnail =
    item.video?.cover?.url_list?.[0] ||
    item.images?.[0]?.url_list?.[0] ||
    "";

  const downloads = [];

  /*
   * IMAGE / PHOTO
   */
  if (
    item.images &&
    item.images.length > 0
  ) {
    item.images.forEach(
      (img, index) => {
        const imgUrl =
          img.url_list?.[0] ||
          img.download_url_list?.[0];

        if (imgUrl) {
          downloads.push({
            type: "image",
            quality:
              `Photo ${index + 1}`,
            url: imgUrl.replace(
              /^http:/,
              "https:"
            ),
            thumbnail: imgUrl.replace(
              /^http:/,
              "https:"
            )
          });
        }
      }
    );
  }

  /*
   * VIDEO
   */
  else {
    let videoUrl =
      item.video?.play_addr
        ?.url_list?.[0] ||
      item.video?.download_addr
        ?.url_list?.[0];

    if (videoUrl) {
      videoUrl = videoUrl
        .replace(
          /^http:/,
          "https:"
        )
        .replace(
          "playwm",
          "play"
        );

      let videoId = null;

      try {
        videoId =
          new URL(
            videoUrl
          ).searchParams.get(
            "video_id"
          );
      } catch (_) {}

      if (!videoId) {
        const match =
          videoUrl.match(
            /video_id=([^&]+)/
          );

        if (match) {
          videoId = match[1];
        }
      }

      const noWatermarkUrl =
        videoId
          ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${videoId}`
          : videoUrl;

      downloads.push({
        type: "video",
        quality:
          "HD No Watermark",
        url: noWatermarkUrl,
        thumbnail
      });

      downloads.push({
        type: "video",
        quality:
          "Standard",
        url: videoUrl,
        thumbnail
      });
    }
  }

  /*
   * AUDIO
   */
  const musicUrl =
    item.music?.play_url
      ?.url_list?.[0] ||
    item.music?.play_url?.uri ||
    null;

  if (
    musicUrl &&
    typeof musicUrl === "string" &&
    musicUrl.startsWith("http")
  ) {
    downloads.push({
      type: "audio",
      quality:
        "Original Audio",
      url: musicUrl.replace(
        /^http:/,
        "https:"
      ),
      thumbnail
    });
  }

  if (
    downloads.length === 0
  ) {
    throw new Error(
      "No downloadable media found."
    );
  }

  return {
    status: true,

    result: {
      title,
      author,
      thumbnail,
      type:
        item.images?.length
          ? "image"
          : "video",
      downloads
    }
  };
}

async function scrapeOnce(url) {
  try {
    if (
      !url ||
      typeof url !== "string"
    ) {
      throw new Error(
        "Invalid URL."
      );
    }

    /*
     * Ini yang membuat full share text
     * Douyin bisa langsung dipakai.
     */
    const cleanUrl =
      extractCleanUrl(url);

    if (!cleanUrl) {
      throw new Error(
        "Douyin URL tidak ditemukan."
      );
    }

    const mobileUA =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";

    const cookieJar = {};

    const saveCookies = (
      headers
    ) => {
      const raw =
        headers?.["set-cookie"];

      if (!raw) return;

      (
        Array.isArray(raw)
          ? raw
          : [raw]
      ).forEach((cookie) => {
        const part =
          cookie.split(";")[0];

        const [key, ...valueParts] =
          part.split("=");

        const value =
          valueParts.join("=");

        if (key && value) {
          cookieJar[
            key.trim()
          ] = value.trim();
        }
      });
    };

    const getCookieHeader = () =>
      Object.entries(
        cookieJar
      )
        .map(
          ([key, value]) =>
            `${key}=${value}`
        )
        .join("; ");

    let targetUrl =
      cleanUrl;

    let itemId =
      extractDouyinItemId(
        cleanUrl
      );

    /*
     * STEP 1
     * Resolve v.douyin.com
     * dan ambil cookie.
     */
    if (
      /v\.douyin\.com/i.test(
        cleanUrl
      )
    ) {
      try {
        const response =
          await axios.get(
            cleanUrl,
            {
              headers: {
                "User-Agent":
                  mobileUA,

                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
              },

              maxRedirects: 0,

              validateStatus:
                (status) =>
                  status >= 200 &&
                  status < 400,

              timeout: 10000
            }
          );

        saveCookies(
          response.headers
        );

        if (
          response.headers
            .location
        ) {
          targetUrl =
            new URL(
              response.headers.location,
              cleanUrl
            ).toString();
        }
      } catch (error) {
        if (
          error.response?.headers
            ?.location
        ) {
          saveCookies(
            error.response.headers
          );

          targetUrl =
            new URL(
              error.response.headers
                .location,
              cleanUrl
            ).toString();
        }
      }
    }

    if (!itemId) {
      itemId =
        extractDouyinItemId(
          targetUrl
        );
    }

    /*
     * Handle share/slides.
     */
    const slidesMatch =
      targetUrl.match(
        /share\/slides\/([0-9]{15,22})/i
      );

    if (
      slidesMatch &&
      slidesMatch[1]
    ) {
      targetUrl =
        `https://www.iesdouyin.com/share/video/${slidesMatch[1]}/`;

      itemId =
        slidesMatch[1];
    }

    /*
     * STEP 2
     * Request halaman awal
     * untuk seed cookies + SSR.
     */
    let htmlStr = "";

    try {
      const response =
        await axios.get(
          targetUrl,
          {
            headers: {
              "User-Agent":
                mobileUA,

              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",

              "Accept-Language":
                "zh-CN,zh;q=0.9,en;q=0.8",

              Cookie:
                getCookieHeader()
            },

            timeout: 15000,

            validateStatus:
              () => true
          }
        );

      saveCookies(
        response.headers
      );

      htmlStr =
        typeof response.data ===
        "string"
          ? response.data
          : "";
    } catch (_) {}

    if (!itemId) {
      itemId =
        extractDouyinItemId(
          targetUrl
        ) ||
        extractDouyinItemId(
          htmlStr
        );
    }

    let parsedData =
      extractRouterOrSSRData(
        htmlStr
      );

    let item =
      getItemFromData(
        parsedData
      );

    /*
     * STEP 3
     * Authenticated request
     * dengan cookie hasil handshake.
     */
    if (!item) {
      try {
        const response =
          await axios.get(
            targetUrl,
            {
              headers: {
                "User-Agent":
                  mobileUA,

                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",

                "Accept-Language":
                  "zh-CN,zh;q=0.9,en;q=0.8",

                Cookie:
                  getCookieHeader(),

                Referer:
                  "https://www.douyin.com/"
              },

              timeout: 15000,

              validateStatus:
                () => true
            }
          );

        saveCookies(
          response.headers
        );

        htmlStr =
          typeof response.data ===
          "string"
            ? response.data
            : "";

        parsedData =
          extractRouterOrSSRData(
            htmlStr
          );

        item =
          getItemFromData(
            parsedData
          );
      } catch (_) {}
    }

    /*
     * STEP 4
     * API fallback kalau item ID ketemu.
     */
    if (
      !item &&
      itemId
    ) {
      const apiItem =
        await fetchDouyinApi(
          itemId,
          getCookieHeader()
        );

      if (apiItem) {
        return buildResult(
          apiItem
        );
      }
    }

    /*
     * STEP 5
     * Desktop UA fallback.
     */
    if (!item) {
      const desktopUA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

      try {
        const response =
          await axios.get(
            targetUrl,
            {
              headers: {
                "User-Agent":
                  desktopUA,

                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                "Accept-Language":
                  "zh-CN,zh;q=0.9,en;q=0.8",

                Cookie:
                  getCookieHeader()
              },

              timeout: 15000,

              validateStatus:
                () => true
            }
          );

        saveCookies(
          response.headers
        );

        const fallbackHtml =
          typeof response.data ===
          "string"
            ? response.data
            : "";

        const fallbackData =
          extractRouterOrSSRData(
            fallbackHtml
          );

        item =
          getItemFromData(
            fallbackData
          );
      } catch (_) {}
    }

    if (!item) {
      throw new Error(
        "Could not find video data in Douyin page."
      );
    }

    return buildResult(
      item
    );
  } catch (error) {
    return {
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Douyin scraper gagal."
    };
  }
}

async function scrape(url) {
  let result;

  try {
    result =
      await scrapeOnce(url);

    if (
      !result ||
      !result.status
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            400
          )
      );

      result =
        await scrapeOnce(url);
    }
  } catch (_) {
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          400
        )
    );

    result =
      await scrapeOnce(url);
  }

  return result;
}

module.exports = {
  scrape
};
