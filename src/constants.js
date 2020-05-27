exports.METHODS = { GET: 'GET', POST: 'POST' }
exports.MARKDOWN_IMAGE_REGEXP_GLOBAL = /!\[[^\]]*\]\(([^\)]*)\)/g
exports.MARKDOWN_ASSET_REGEXP_GLOBAL = /[^!]\[[^\]]*\]\(([^\)]*)\)/g
exports.MARKDOWN_IMAGE_REGEXP = /!\[[^\]]*\]\(([^\)]*)\)/
exports.MARKDOWN_ASSET_REGEXP = /[^!]\[[^\]]*\]\(([^\)]*)\)/

exports.TYPE_PREFIX_COCKPIT = 'Cockpit'

function createConfigMessage(message) {
  return `
gatsby-source-cockpit: config error

    ${message}

Docs: https://github.com/fikaproductions/fika-gatsby-source-cockpit#how-to-use
  `
}

exports.INVALID_BASE_URL = createConfigMessage('"baseUrl" must be a string')
exports.INVALID_TOKEN = createConfigMessage('"token" must be a string')
exports.INVALID_LOCALES = createConfigMessage(
  '"locales" must be a (possibly empty) list of locales'
)
exports.INVALID_WHITE_LISTED_COLLECTION_NAMES = createConfigMessage(
  "'whiteListedCollectionNames' must be a list or undefined"
)
exports.INVALID_WHITE_LISTED_SINGLETON_NAMES = createConfigMessage(
  "'whiteListedSingletonNames' must be a list or undefined"
)
exports.INVALID_ALIASES = createConfigMessage(
  "'aliases' must be an object or undefined"
)
