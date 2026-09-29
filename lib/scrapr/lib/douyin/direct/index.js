function extractCleanUrl(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  /*
   * Cari URL Douyin dari teks Share.
   *
   * Contoh:
   * 2.56 复制打开抖音，看看【Tang77丶的作品】...
   * https://v.douyin.com/Zi665n-9UVg/
   * 01/15 n@D.UY
   */
  const matches = text.match(
    /https?:\/\/[^\s<>"']+/gi
  );

  if (matches && matches.length) {
    const douyinUrl =
      matches.find((item) =>
        /douyin\.com/i.test(item)
      );

    if (douyinUrl) {
      return douyinUrl
        .replace(/[)\],.;!?]+$/g, "")
        .trim();
    }

    return matches[0]
      .replace(/[)\],.;!?]+$/g, "")
      .trim();
  }

  let clean =
    text.trim();

  if (
    !clean.startsWith(
      "http://"
    ) &&
    !clean.startsWith(
      "https://"
    )
  ) {
    clean =
      "https://" + clean;
  }

  return clean;
}
