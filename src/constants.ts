export const METHODS: { GET: string; POST: string } = {
  GET: 'GET',
  POST: 'POST',
}
export const MARKDOWN_IMAGE_REGEXP_GLOBAL: RegExp = /!\[[^\]]*\]\(([^\)]*)\)/g
export const MARKDOWN_ASSET_REGEXP_GLOBAL: RegExp = /[^!]\[[^\]]*\]\(([^\)]*)\)/g
export const MARKDOWN_IMAGE_REGEXP: RegExp = /!\[[^\]]*\]\(([^\)]*)\)/
export const MARKDOWN_ASSET_REGEXP: RegExp = /[^!]\[[^\]]*\]\(([^\)]*)\)/
export const TYPE_PREFIX_COCKPIT: string = 'Cockpit'

export const DEFAULT_LANGUAGE_LOCALE = 'any'
