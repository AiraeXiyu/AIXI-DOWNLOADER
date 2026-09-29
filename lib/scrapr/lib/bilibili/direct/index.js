const axios = require("axios");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BILI_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language":
    "zh-CN,zh;q=0.9,en;q=0.8",
  Referer:
    "https://www.bilibili.com/",
  Origin:
    "https://www.bilibili.com",
  "Sec-Fetch-Dest":
    "document",
  "Sec-Fetch-Mode":
    "navigate",
  "Sec-Fetch-Site":
    "same-origin",
  "Upgrade-Insecure-Requests":
    "1",
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
  const value = text || "";

  const bv =
    value.match(
      /(?:BV)([a-zA-Z0-9]+)/i
    );

  const av =
    value.match(
      /(?:video\/av|[?&]aid=|av)(\d+)/i
    );

  return {
    bvid: bv
      ? `BV${bv[1]}`
      : null,

    aid: av
      ? av[1]
      : null,
  };
}

async function resolveB23(url) {
  try {
    const response =
      await axios.get(url, {
        maxRedirects: 8,
        timeout: 10000,

        headers: {
          ...BILI_HEADERS,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

    const finalUrl =
      response?.request?.res
        ?.responseUrl ||
      response?.request
        ?.responseURL ||
      response?.request
        ?.res?.request?.uri?.href ||
      "";

    if (finalUrl) {
      return finalUrl;
    }

    const html =
      typeof response.data === "string"
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
  } catch (_) {}

  return null;
}

async function resolveShortLink(url) {
  const clean =
    extractUrl(url);

  if (
    /b23\.tv\//i.test(clean)
  ) {
    const resolved =
      await resolveB23(clean);

    if (resolved) {
      return resolved;
    }
  }

  return clean;
}

function parseJsonScript(
  html,
  pattern
) {
  const match =
    html.match(pattern);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch (_) {
    return null;
  }
}

function extractPlayInfo(html) {
  if (!html) {
    return null;
  }

  /*
   * Format:
   * window.__playinfo__ = {...}
   */
  let match =
    html.match(
      /window\.__playinfo__\s*=\s*({.+?})\s*<\/script>/s
    );

  if (match) {
    try {
      return JSON.parse(
        match[1]
      );
    } catch (_) {}
  }

  /*
   * Format:
   * __playinfo__ = {...}
   */
  match =
    html.match(
      /__playinfo__\s*=\s*({.+?})\s*;?\s*(?:<\/script>|$)/s
    );

  if (match) {
    try {
      return JSON.parse(
        match[1]
      );
    } catch (_) {}
  }

  /*
   * Format:
   * <script id="__NEXT_DATA__">
   */
  const nextData =
    parseJsonScript(
      html,
      /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
    );

  if (nextData) {
    const possible =
      nextData?.props
        ?.pageProps
        ?.playinfo ||
      nextData?.props
        ?.pageProps
        ?.videoInfo ||
      nextData?.props
        ?.pageProps
        ?.videoData;

    if (possible) {
      return possible;
    }
  }

  return null;
}

function extractInitialState(
  html
) {
  if (!html) {
    return null;
  }

  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*({.+?})\s*;\s*<\/script>/s,
    /window\.__INITIAL_STATE__\s*=\s*({.+?})\s*;\s*$/s,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      html.match(pattern);

    if (!match) {
      continue;
    }

    try {
      return JSON.parse(
        match[1]
      );
    } catch (_) {}
  }

  return null;
}

function collectDurl(
  playInfo,
  thumbnail
) {
  const downloads = [];

  const durl =
    playInfo?.data?.durl ||
    playInfo?.durl ||
    [];

  for (
    const item of durl
  ) {
    if (!item?.url) {
      continue;
    }

    downloads.push({
      quality:
        item.size
          ? "720p"
          : "Video",

      type: "video",

      url: String(
        item.url
      ).replace(
        "http://",
        "https://"
      ),

      thumbnail:
        thumbnail || "",
    });
  }

  return downloads;
}

function collectDash(
  playInfo,
  thumbnail
) {
  const downloads = [];

  const video =
    playInfo?.data?.dash
      ?.video ||
    playInfo?.dash
      ?.video ||
    [];

  for (
    const item of video
  ) {
    const url =
      item?.baseUrl ||
      item?.base_url ||
      item?.backupUrl?.[0] ||
      item?.backup_url?.[0];

    if (!url) {
      continue;
    }

    downloads.push({
      quality:
        item.height
          ? `${item.height}p`
          : item.width
            ? `${item.width}p`
            : "Video",

      type: "video",

      url: String(
        url
      ).replace(
        "http://",
        "https://"
      ),

      thumbnail:
        thumbnail || "",
    });
  }

  return downloads;
}

function extractPageVideoData(
  html
) {
  const playInfo =
    extractPlayInfo(html);

  const state =
    extractInitialState(html);

  let title =
    "Bilibili Video";

  let thumbnail = "";

  let owner = null;

  let bvid = null;

  let aid = null;

  let cid = null;

  if (state) {
    const videoData =
      state.videoData ||
      state.videoInfo ||
      state.video ||
      state;

    title =
      videoData?.title ||
      title;

    thumbnail =
      videoData?.pic ||
      videoData?.cover ||
      thumbnail;

    owner =
      videoData?.owner ||
      null;

    bvid =
      videoData?.bvid ||
      null;

    aid =
      videoData?.aid ||
      null;

    cid =
      videoData?.cid ||
      videoData?.pages?.[0]?.cid ||
      null;
  }

  if (playInfo) {
    const infoData =
      playInfo?.data ||
      playInfo;

    if (
      infoData?.videoInfo
    ) {
      title =
        infoData.videoInfo.title ||
        title;

      thumbnail =
        infoData.videoInfo.pic ||
        thumbnail;

      bvid =
        infoData.videoInfo.bvid ||
        bvid;

      aid =
        infoData.videoInfo.aid ||
        aid;
    }

    const pages =
      infoData?.pages ||
      infoData?.videoData
        ?.pages ||
      [];

    if (
      !cid &&
      Array.isArray(pages) &&
      pages.length > 0
    ) {
      cid =
        pages[0]?.cid ||
        null;
    }
  }

  const downloads = [
    ...collectDurl(
      playInfo,
      thumbnail
    ),
    ...collectDash(
      playInfo,
      thumbnail
    ),
  ];

  return {
    playInfo,
    title,
    thumbnail,
    owner,
    bvid,
    aid,
    cid,
    downloads,
  };
}

async function fetchVideoPage(
  cleanUrl
) {
  try {
    const response =
      await axios.get(
        cleanUrl,
        {
          maxRedirects: 8,
          timeout: 15000,
          headers:
            BILI_HEADERS,
          validateStatus:
            () => true,
        }
      );

    if (
      response.status >= 400
    ) {
      return null;
    }

    const html =
      typeof response.data ===
      "string"
        ? response.data
        : "";

    if (!html) {
      return null;
    }

    return {
      html,
      finalUrl:
        response?.request?.res
          ?.responseUrl ||
        response?.request
          ?.responseURL ||
        cleanUrl,
    };
  } catch (_) {
    return null;
  }
}

async function fetchViewApi(
  bvid,
  aid
) {
  const params = bvid
    ? { bvid }
    : { aid };

  const url =
    "https://api.bilibili.com/x/web-interface/view";

  const headers = {
    ...BILI_HEADERS,

    Accept:
      "application/json, text/plain, */*",

    "Sec-Fetch-Dest":
      "empty",

    "Sec-Fetch-Mode":
      "cors",

    "Sec-Fetch-Site":
      "same-site",
  };

  try {
    const response =
      await axios.get(
        url,
        {
          params,
          headers,
          timeout: 12000,
          validateStatus:
            () => true,
        }
      );

    if (
      response.status ===
      412
    ) {
      return {
        status: false,
        blocked: true,
        data: null,
      };
    }

    if (
      response.status >= 400
    ) {
      return {
        status: false,
        blocked: false,
        data: null,
      };
    }

    if (
      response.data?.code !==
      0
    ) {
      return {
        status: false,
        blocked:
          response.data?.code ===
          -412,
        data: null,
      };
    }

    return {
      status: true,
      blocked: false,
      data:
        response.data.data,
    };
  } catch (_) {
    return {
      status: false,
      blocked: false,
      data: null,
    };
  }
}

async function fetchPlayUrl(
  bvid,
  cid
) {
  if (!bvid || !cid) {
    return null;
  }

  const url =
    "https://api.bilibili.com/x/player/playurl";

  try {
    const response =
      await axios.get(
        url,
        {
          params: {
            bvid,
            cid,
            qn: 64,
            fnval: 1,
            fnver: 0,
            fourk: 1,
          },

          headers: {
            ...BILI_HEADERS,

            Accept:
              "application/json, text/plain, */*",

            "Sec-Fetch-Dest":
              "empty",

            "Sec-Fetch-Mode":
              "cors",

            "Sec-Fetch-Site":
              "same-site",
          },

          timeout: 15000,

          validateStatus:
            () => true,
        }
      );

    if (
      response.status >= 400
    ) {
      return null;
    }

    if (
      response.data?.code !==
      0
    ) {
      return null;
    }

    return response.data.data;
  } catch (_) {
    return null;
  }
}

async function scrapeBilibiliTv(
  cleanUrl
) {
  const urlObj =
    new URL(cleanUrl);

  const parts =
    urlObj.pathname
      .split("/")
      .filter(Boolean);

  let apiInfo = null;

  let title =
    "Bilibili.tv Video";

  let thumbnail = "";

  const idxVideo =
    parts.indexOf("video");

  if (idxVideo !== -1) {
    const aid =
      parts[idxVideo + 1];

    if (
      aid &&
      /^\d+$/.test(aid)
    ) {
      apiInfo = {
        tipo: "video",
        id: aid,
      };
    }
  }

  const idxPlay =
    parts.indexOf("play");

  if (idxPlay !== -1) {
    const numericParts =
      parts
        .slice(idxPlay + 1)
        .filter((p) =>
          /^\d+$/.test(p)
        );

    if (
      numericParts.length > 1
    ) {
      apiInfo = {
        tipo: "anime",
        id:
          numericParts[1],
      };
    } else if (
      numericParts.length === 1
    ) {
      apiInfo = {
        tipo: "anime",
        id: null,
        seasonId:
          numericParts[0],
      };
    }
  }

  if (!apiInfo) {
    throw new Error(
      "Could not parse Bilibili.tv video or episode ID."
    );
  }

  if (
    apiInfo.tipo ===
      "anime" &&
    !apiInfo.id &&
    apiInfo.seasonId
  ) {
    try {
      const { data } =
        await axios.get(
          `https://api.bilibili.tv/intl/gateway/web/v2/ogv/play/episodes?season_id=${apiInfo.seasonId}&platform=web&s_locale=en_US`,
          {
            timeout: 8000,
          }
        );

      if (
        data?.data
          ?.sections?.[0]
          ?.episodes?.[0]
      ) {
        const firstEp =
          data.data
            .sections[0]
            .episodes[0];

        apiInfo.id =
          firstEp.episode_id ||
          firstEp.ep_id ||
          firstEp.id;

        title =
          firstEp.title_display ||
          title;

        thumbnail =
          firstEp.cover ||
          thumbnail;
      }
    } catch (_) {}
  }

  const downloads = [];

  if (
    apiInfo.tipo ===
      "anime" &&
    (
      apiInfo.id ||
      apiInfo.seasonId
    )
  ) {
    const param =
      apiInfo.id
        ? `ep_id=${apiInfo.id}`
        : `season_id=${apiInfo.seasonId}`;

    const { data } =
      await axios.get(
        `https://api.bilibili.tv/intl/gateway/v2/ogv/playurl?${param}&platform=web&s_locale=en_US`,
        {
          timeout: 8000,
        }
      );

    const streamList =
      data?.data?.video_info
        ?.stream_list || [];

    streamList.forEach(
      (stream) => {
        const playUrl =
          stream.url ||
          stream.url_list?.[0]
            ?.url ||
          stream.dash_video
            ?.base_url ||
          stream.dash_video
            ?.backup_url?.[0];

        if (playUrl) {
          downloads.push({
            quality:
              stream
                .stream_info
                ?.display_desc ||
              stream
                .stream_info
                ?.description ||
              (
                stream.quality
                  ? `${stream.quality}p`
                  : "720p"
              ),

            type: "video",

            url: playUrl.replace(
              "http://",
              "https://"
            ),
          });
        }
      }
    );
  }

  if (
    downloads.length === 0
  ) {
    throw new Error(
      "No download streams returned from Bilibili.tv API."
    );
  }

  return {
    status: true,

    result: {
      title,
      thumbnail,
      type: "video",
      downloads,
    },
  };
}

async function scrape(url) {
  try {
    let cleanUrl =
      extractUrl(url);

    if (!cleanUrl) {
      throw new Error(
        "Link Bilibili tidak boleh kosong."
      );
    }

    /*
     * Resolve b23.tv.
     */
    if (
      /b23\.tv\//i.test(
        cleanUrl
      )
    ) {
      cleanUrl =
        await resolveShortLink(
          cleanUrl
        );
    }

    /*
     * Bilibili TV / international.
     */
    if (
      /bilibili\.tv/i.test(
        cleanUrl
      )
    ) {
      return await scrapeBilibiliTv(
        cleanUrl
      );
    }

    /*
     * Ambil BV/AV dari URL.
     */
    let {
      bvid,
      aid,
    } = extractIds(
      cleanUrl
    );

    /*
     * Kalau belum ada ID,
     * coba resolve sekali lagi.
     */
    if (!bvid && !aid) {
      const resolved =
        await resolveShortLink(
          cleanUrl
        );

      if (resolved) {
        cleanUrl =
          resolved;

        ({
          bvid,
          aid,
        } = extractIds(
          cleanUrl
        ));
      }
    }

    if (!bvid && !aid) {
      throw new Error(
        "Bilibili link tidak berisi BV/AV ID dan short link tidak bisa di-resolve."
      );
    }

    /*
     * ==================================================
     * PRIORITAS 1
     * Ambil data langsung dari halaman Bilibili.
     *
     * Ini penting karena endpoint:
     * /x/web-interface/view
     * dapat terkena HTTP 412 pada server/datacenter.
     * ==================================================
     */

    const page =
      await fetchVideoPage(
        cleanUrl
      );

    if (page) {
      const pageData =
        extractPageVideoData(
          page.html
        );

      if (
        pageData.bvid
      ) {
        bvid =
          pageData.bvid;
      }

      if (
        pageData.aid
      ) {
        aid =
          pageData.aid;
      }

      /*
       * Kalau halaman sudah menyediakan
       * durl / DASH, langsung gunakan.
       *
       * Tidak perlu request API metadata.
       */
      if (
        pageData.downloads.length >
        0
      ) {
        return {
          status: true,

          result: {
            title:
              pageData.title ||
              "Bilibili Video",

            thumbnail:
              pageData.thumbnail ||
              "",

            type: "video",

            author: {
              name:
                pageData.owner
                  ?.name ||
                "Bilibili Creator",

              mid:
                pageData.owner
                  ?.mid,
            },

            downloads:
              pageData.downloads,
          },
        };
      }

      /*
       * Kalau halaman punya cid tetapi
       * playinfo tidak berisi stream,
       * coba player API.
       */
      if (
        bvid &&
        pageData.cid
      ) {
        const playData =
          await fetchPlayUrl(
            bvid,
            pageData.cid
          );

        if (playData) {
          const downloads = [
            ...collectDurl(
              playData,
              pageData.thumbnail
            ),
            ...collectDash(
              playData,
              pageData.thumbnail
            ),
          ];

          if (
            downloads.length >
            0
          ) {
            return {
              status: true,

              result: {
                title:
                  pageData.title ||
                  "Bilibili Video",

                thumbnail:
                  pageData.thumbnail ||
                  "",

                type: "video",

                author: {
                  name:
                    pageData.owner
                      ?.name ||
                    "Bilibili Creator",

                  mid:
                    pageData.owner
                      ?.mid,
                },

                downloads,
              },
            };
          }
        }
      }
    }

    /*
     * ==================================================
     * PRIORITAS 2
     * Fallback API metadata.
     * ==================================================
     */

    const view =
      await fetchViewApi(
        bvid,
        aid
      );

    if (
      view.status &&
      view.data
    ) {
      const data =
        view.data;

      const cid =
        data.cid ||
        data.pages?.[0]
          ?.cid;

      const effectiveBvid =
        data.bvid ||
        bvid;

      if (!cid) {
        throw new Error(
          "Could not find video cid from Bilibili API."
        );
      }

      const playData =
        await fetchPlayUrl(
          effectiveBvid,
          cid
        );

      if (!playData) {
        throw new Error(
          "Bilibili tidak mengembalikan data video."
        );
      }

      const downloads = [
        ...collectDurl(
          playData,
          data.pic
        ),
        ...collectDash(
          playData,
          data.pic
        ),
      ];

      if (
        downloads.length === 0
      ) {
        throw new Error(
          "No download stream URLs returned from Bilibili API."
        );
      }

      return {
        status: true,

        result: {
          title:
            data.title ||
            "Bilibili Video",

          thumbnail:
            data.pic ||
            "",

          type: "video",

          author: {
            name:
              data.owner
                ?.name ||
              "Bilibili Creator",

            mid:
              data.owner
                ?.mid,
          },

          downloads,
        },
      };
    }

    /*
     * Kalau fallback API juga 412,
     * kasih pesan yang jelas.
     */
    if (view.blocked) {
      throw new Error(
        "Bilibili sedang memblokir request server (HTTP 412). Data video tidak tersedia dari halaman maupun API."
      );
    }

    throw new Error(
      "Failed to fetch video details from Bilibili."
    );
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
