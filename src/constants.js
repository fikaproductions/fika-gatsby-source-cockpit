exports.METHODS = { GET: "GET", POST: "POST" };
exports.MARKDOWN_IMAGE_REGEXP_GLOBAL = /!\[[^\]]*\]\(([^\)]*)\)/g;
exports.MARKDOWN_ASSET_REGEXP_GLOBAL = /[^!]\[[^\]]*\]\(([^\)]*\.[a-zA-Z]{2,4})\)/g;
exports.MARKDOWN_IMAGE_REGEXP = /!\[[^\]]*\]\(([^\)]*)\)/;
exports.MARKDOWN_ASSET_REGEXP = /[^!]\[[^\]]*\]\(([^\)]*)\)/;
