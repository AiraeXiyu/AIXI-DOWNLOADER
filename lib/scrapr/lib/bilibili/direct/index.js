const axios = require("axios");

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
      : null
  };
}

async function resolveB23(url) {
  try {
    const response =
      await axios.get(url, {
        maxRedirects: 8,
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
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

    /*
     * Fallback: cari BV dari HTML.
     */
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
  const clean = extractUrl(url);

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

async function scrapeBilibiliTv(cleanUrl) {
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
        id: aid
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
        id: numericParts[1]
      };
    } else if (
      numericParts.length === 1
    ) {
      apiInfo = {
        tipo: "anime",
        id: null,
        seasonId:
          numericParts[0]
      };
    }
  }

  if (!apiInfo) {
    throw new Error(
      "Could not parse Bilibili.tv video or episode ID."
    );
  }

  if (
    apiInfo.tipo === "anime" &&
    !apiInfo.id &&
    apiInfo.seasonId
  ) {
    try {
      const { data } =
        await axios.get(
          `https://api.bilibili.tv/intl/gateway/web/v2/ogv/play/episodes?season_id=${apiInfo.seasonId}&platform=web&s_locale=en_US`,
          { timeout: 8000 }
        );

      if (
        data?.data?.sections?.[0]
          ?.episodes?.[0]
      ) {
        const firstEp =
          data.data.sections[0]
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
    apiInfo.tipo === "anime" &&
    (apiInfo.id ||
      apiInfo.seasonId)
  ) {
    const param = apiInfo.id
      ? `ep_id=${apiInfo.id}`
      : `season_id=${apiInfo.seasonId}`;

    const { data } =
      await axios.get(
        `https://api.bilibili.tv/intl/gateway/v2/ogv/playurl?${param}&platform=web&s_locale=en_US`,
        { timeout: 8000 }
      );

    const streamList =
      data?.data?.video_info
        ?.stream_list || [];

    streamList.forEach((stream) => {
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
            stream.stream_info
              ?.display_desc ||
            stream.stream_info
              ?.description ||
            (stream.quality
              ? `${stream.quality}p`
              : "720p"),

          type: "video",

          url: playUrl.replace(
            "http://",
            "https://"
          )
        });
      }
    });
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
      downloads
    }
  };
}

async function scrape(url) {
  try {
    let cleanUrl =
      extractUrl(url);

    /*
     * Resolve b23.tv sebelum
     * mencari BV/AV.
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
     * Mainland Bilibili.
     */
    let {
      bvid,
      aid
    } = extractIds(
      cleanUrl
    );

    /*
     * Kalau URL final masih belum
     * mengandung BV/AV, coba resolve
     * sekali lagi.
     */
    if (!bvid && !aid) {
      const resolved =
        await resolveShortLink(
          cleanUrl
        );

      if (resolved) {
        ({
          bvid,
          aid
        } = extractIds(
          resolved
        ));
      }
    }

    if (!bvid && !aid) {
      throw new Error(
        "Bilibili link tidak berisi BV/AV ID dan short link tidak bisa di-resolve."
      );
    }

    const viewUrl = bvid
      ? `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
      : `https://api.bilibili.com/x/web-interface/view?aid=${aid}`;

    const headers = {
      Referer:
        "https://www.bilibili.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"
    };

    const {
      data: viewRes
    } = await axios.get(
      viewUrl,
      {
        headers,
        timeout: 10000
      }
    );

    if (
      !viewRes ||
      viewRes.code !== 0 ||
      !viewRes.data
    ) {
      throw new Error(
        viewRes?.message ||
          "Failed to fetch video details from Bilibili API."
      );
    }

    const data =
      viewRes.data;

    const cid =
      data.cid ||
      data.pages?.[0]?.cid;

    const effectiveBvid =
      data.bvid || bvid;

    if (!cid) {
      throw new Error(
        "Could not find video cid from Bilibili API."
      );
    }

    const playUrl =
      `https://api.bilibili.com/x/player/playurl?bvid=${effectiveBvid}&cid=${cid}&qn=64`;

    const {
      data: playRes
    } = await axios.get(
      playUrl,
      {
        headers,
        timeout: 10000
      }
    );

    const durl =
      playRes?.data?.durl ||
      [];

    const downloads =
      durl.map((item) => ({
        quality:
          item.size
            ? "720p"
            : "Video",

        type: "video",

        url: String(
          item.url || ""
        ).replace(
          "http://",
          "https://"
        ),

        thumbnail:
          data.pic || ""
      })).filter(
        (item) => item.url
      );

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
          data.pic || "",

        type: "video",

        author: {
          name:
            data.owner?.name ||
            "Bilibili Creator",

          mid:
            data.owner?.mid
        },

        downloads
      }
    };
  } catch (error) {
    return {
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Bilibili scraper gagal."
    };
  }
}

module.exports = {
  scrape
};
