const axios = require("axios");
const crypto = require("crypto");

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32,
  15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 19, 60,
  39, 48, 34, 20, 26, 59, 30, 28,
  44, 4, 25, 16, 24, 11, 47, 1,
  38, 22, 29, 17, 0, 21, 56, 37,
  7, 54, 6, 42, 40, 14, 57, 36,
  12, 51, 13, 41, 55, 52, 62, 61
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BASE_HEADERS = {
  "User-Agent": USER_AGENT,
  Referer: "https://www.bilibili.com/",
  Origin: "https://www.bilibili.com",
  Accept:
    "application/json, text/plain, */*",
  "Accept-Language":
    "en-US,en;q=0.9",
  Connection: "keep-alive",
};

function extractUrl(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  const match = text.match(
    /https?:\/\/[^\s<>"']+/i
  );

  if (!match) {
    return text.trim();
  }

  return match[0]
    .replace(/[)\],.;!?]+$/g, "")
    .trim();
}

function extractIds(text) {
  const value = String(text || "");

  const bv =
    value.match(
      /(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]{10,})/i
    ) ||
    value.match(
      /(BV[a-zA-Z0-9]{10,})/i
    );

  const av =
    value.match(
      /(?:\/video\/av|[?&](?:aid|av)=|\/av)(\d+)/i
    );

  return {
    bvid: bv ? bv[1] : null,
    aid: av ? av[1] : null,
  };
}

async function createSession() {
  const client =
    axios.create({
      headers: {
        ...BASE_HEADERS,
      },
      timeout: 15000,
      validateStatus: () => true,
    });

  try {
    /*
     * Bilibili menggunakan cookie browser
     * seperti buvid sebagai bagian dari
     * risk-control. Ambil cookie terlebih
     * dahulu dari halaman utama.
     */
    const response =
      await client.get(
        "https://www.bilibili.com/"
      );

    const setCookie =
      response.headers?.["set-cookie"] ||
      [];

    const cookies =
      setCookie
        .map((cookie) =>
          cookie.split(";")[0]
        )
        .filter(Boolean)
        .join("; ");

    if (cookies) {
      client.defaults.headers.Cookie =
        cookies;
    }
  } catch (_) {}

  return client;
}

async function getWbiKeys(client) {
  const response =
    await client.get(
      "https://api.bilibili.com/x/web-interface/nav"
    );

  if (
    response.status >= 400 ||
    !response.data?.data?.wbi_img
  ) {
    throw new Error(
      `Bilibili WBI initialization failed (HTTP ${response.status}).`
    );
  }

  const {
    img_url,
    sub_url,
  } =
    response.data.data.wbi_img;

  const imgKey =
    String(img_url || "")
      .split("/")
      .pop()
      ?.split(".")[0] || "";

  const subKey =
    String(sub_url || "")
      .split("/")
      .pop()
      ?.split(".")[0] || "";

  if (!imgKey || !subKey) {
    throw new Error(
      "Bilibili WBI key tidak ditemukan."
    );
  }

  return {
    imgKey,
    subKey,
  };
}

function getMixinKey(
  imgKey,
  subKey
) {
  const origin =
    `${imgKey}${subKey}`;

  return MIXIN_KEY_ENC_TAB
    .map((index) =>
      origin[index]
    )
    .join("")
    .slice(0, 32);
}

function wbiSign(
  params,
  imgKey,
  subKey
) {
  const mixinKey =
    getMixinKey(
      imgKey,
      subKey
    );

  const signed = {
    ...params,
    wts: Math.floor(
      Date.now() / 1000
    ),
  };

  const filtered =
    Object.entries(signed)
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .map(
        ([key, value]) => [
          key,
          String(value).replace(
            /[!'()*]/g,
            ""
          ),
        ]
      );

  const query =
    new URLSearchParams(
      filtered
    ).toString();

  const wRid =
    crypto
      .createHash("md5")
      .update(
        query + mixinKey
      )
      .digest("hex");

  return {
    ...signed,
    w_rid: wRid,
  };
}

async function resolveB23(client, url) {
  let currentUrl = url;

  for (let i = 0; i < 8; i++) {
    try {
      const response =
        await client.get(
          currentUrl,
          {
            maxRedirects: 0,
            validateStatus: (status) =>
              status >= 200 &&
              status < 400,
          }
        );

      const location =
        response.headers?.location;

      if (location) {
        currentUrl =
          new URL(
            location,
            currentUrl
          ).toString();

        const ids =
          extractIds(
            currentUrl
          );

        if (
          ids.bvid ||
          ids.aid
        ) {
          return currentUrl;
        }

        continue;
      }

      const finalUrl =
        response?.request?.res
          ?.responseUrl ||
        response?.request
          ?.responseURL ||
        "";

      if (finalUrl) {
        const ids =
          extractIds(finalUrl);

        if (
          ids.bvid ||
          ids.aid
        ) {
          return finalUrl;
        }

        currentUrl =
          finalUrl;
      }

      const html =
        typeof response.data ===
        "string"
          ? response.data
          : "";

      const ids =
        extractIds(html);

      if (ids.bvid) {
        return `https://www.bilibili.com/video/${ids.bvid}`;
      }

      if (ids.aid) {
        return `https://www.bilibili.com/video/av${ids.aid}`;
      }
    } catch (_) {
      break;
    }
  }

  return currentUrl;
}

async function resolveShortLink(
  client,
  url
) {
  const clean =
    extractUrl(url);

  if (
    /b23\.tv\//i.test(clean)
  ) {
    return (
      await resolveB23(
        client,
        clean
      )
    ) || clean;
  }

  return clean;
}

async function getVideoInfo(
  client,
  bvid,
  aid,
  wbiKeys
) {
  const params = bvid
    ? { bvid }
    : { aid };

  const signed =
    wbiSign(
      params,
      wbiKeys.imgKey,
      wbiKeys.subKey
    );

  const response =
    await client.get(
      "https://api.bilibili.com/x/web-interface/view",
      {
        params: signed,
      }
    );

  if (
    response.status === 412
  ) {
    throw new Error(
      "Bilibili menolak request metadata (HTTP 412)."
    );
  }

  if (
    response.status >= 400
  ) {
    throw new Error(
      `Bilibili API HTTP ${response.status}.`
    );
  }

  if (
    !response.data ||
    response.data.code !== 0 ||
    !response.data.data
  ) {
    throw new Error(
      response.data?.message ||
        "Gagal mengambil informasi video Bilibili."
    );
  }

  return response.data.data;
}

async function getPlayUrl(
  client,
  data,
  wbiKeys
) {
  const cid =
    data.cid ||
    data.pages?.[0]?.cid;

  if (!cid) {
    throw new Error(
      "CID video Bilibili tidak ditemukan."
    );
  }

  const bvid =
    data.bvid;

  const params = {
    bvid,
    cid,
    qn: 64,
    fnval: 1,
    fnver: 0,
    fourk: 1,
  };

  const signed =
    wbiSign(
      params,
      wbiKeys.imgKey,
      wbiKeys.subKey
    );

  const response =
    await client.get(
      "https://api.bilibili.com/x/player/wbi/playurl",
      {
        params: signed,
      }
    );

  if (
    response.status === 412
  ) {
    throw new Error(
      "Bilibili menolak request video (HTTP 412)."
    );
  }

  if (
    response.status >= 400
  ) {
    throw new Error(
      `Bilibili playurl HTTP ${response.status}.`
    );
  }

  if (
    !response.data ||
    response.data.code !== 0
  ) {
    throw new Error(
      response.data?.message ||
        "Gagal mengambil link video Bilibili."
    );
  }

  return response.data.data;
}

async function scrape(url) {
  try {
    const client =
      await createSession();

    let cleanUrl =
      extractUrl(url);

    if (!cleanUrl) {
      throw new Error(
        "Link Bilibili tidak boleh kosong."
      );
    }

    if (
      /b23\.tv\//i.test(
        cleanUrl
      )
    ) {
      cleanUrl =
        await resolveShortLink(
          client,
          cleanUrl
        );
    }

    const {
      bvid,
      aid,
    } = extractIds(
      cleanUrl
    );

    if (!bvid && !aid) {
      throw new Error(
        "Bilibili link tidak berisi BV/AV ID dan short link tidak bisa di-resolve."
      );
    }

    const wbiKeys =
      await getWbiKeys(
        client
      );

    const data =
      await getVideoInfo(
        client,
        bvid,
        aid,
        wbiKeys
      );

    const playData =
      await getPlayUrl(
        client,
        data,
        wbiKeys
      );

    const downloads = [];

    /*
     * DASH video.
     */
    const dashVideo =
      playData?.dash?.video ||
      [];

    for (
      const video of dashVideo
    ) {
      const videoUrl =
        video.baseUrl ||
        video.base_url ||
        video.backupUrl?.[0] ||
        video.backup_url?.[0];

      if (!videoUrl) {
        continue;
      }

      downloads.push({
        quality:
          video.height
            ? `${video.height}p`
            : "Video",

        type: "video",

        url:
          String(
            videoUrl
          ).replace(
            "http://",
            "https://"
          ),

        thumbnail:
          data.pic || "",
      });
    }

    /*
     * Fallback durl.
     */
    if (
      downloads.length === 0
    ) {
      const durl =
        playData?.durl ||
        [];

      for (
        const item of durl
      ) {
        if (!item.url) {
          continue;
        }

        downloads.push({
          quality:
            item.size
              ? "720p"
              : "Video",

          type: "video",

          url:
            String(
              item.url
            ).replace(
              "http://",
              "https://"
            ),

          thumbnail:
            data.pic || "",
        });
      }
    }

    if (
      downloads.length === 0
    ) {
      throw new Error(
        "Bilibili tidak mengembalikan link download."
      );
    }

    return {
      status: true,

      result: {
        title:
          data.title ||
          "Bilibili Video",

        thumbnail:
          data.pic || "",

        type: "video",

        author: {
          name:
            data.owner?.name ||
            "Bilibili Creator",

          mid:
            data.owner?.mid,
        },

        downloads,
      },
    };
  } catch (error) {
    return {
      status: false,

      message:
        error instanceof Error
          ? error.message
          : "Bilibili scraper gagal.",
    };
  }
}

module.exports = {
  scrape,
};
