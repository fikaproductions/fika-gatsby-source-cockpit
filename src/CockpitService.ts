import { getType } from 'mime'
import request from 'request-promise'
import slugify from 'slugify'
import hash from 'string-hash'

import { MARKDOWN_ASSET_REGEXP, MARKDOWN_IMAGE_REGEXP, METHODS } from './constants'
import { getFieldsOfTypes } from './helpers.js'

interface Aliases {
  collection: { [name: string]: string }
  singleton: { [name: string]: string }
}

export default class CockpitService {
  private baseUrl: string
  private token: string
  private locales: string[]
  private whiteListedCollectionNames: string[]
  private whiteListedSingletonNames: string[]
  private aliases: Aliases

  constructor(
    baseUrl: string,
    token: string,
    locales: string[],
    whiteListedCollectionNames: string[] = [],
    whiteListedSingletonNames: string[] = [],
    aliases: Aliases = { collection: {}, singleton: {} }
  ) {
    this.baseUrl = baseUrl
    this.token = token
    this.locales = locales
    this.whiteListedCollectionNames = whiteListedCollectionNames
    this.whiteListedSingletonNames = whiteListedSingletonNames
    this.aliases = aliases
  }

  public async validateBaseUrl() {
    try {
      await this.fetch('', METHODS.GET)
    } catch (error) {
      throw new Error('BaseUrl config parameter is invalid or there is no internet connection')
    }
  }

  public async validateToken() {
    try {
      await this.fetch('/collections/listCollections', METHODS.GET)
    } catch (error) {
      throw new Error('Token config parameter is invalid')
    }
  }

  public async getCollections() {
    const names = await this.getCollectionNames()
    const whiteListedNames = this.whiteListedCollectionNames

    return Promise.all(
      names
        .filter(
          (name: string) =>
            whiteListedNames === null ||
            (Array.isArray(whiteListedNames) && whiteListedNames.length === 0) ||
            whiteListedNames.includes(name)
        )
        .map((name: string) => this.getCollection(name))
    )
  }

  public async getSingletons() {
    const names = await this.getSingletonNames()
    const whiteListedNames = this.whiteListedSingletonNames

    return Promise.all(
      names
        .filter(
          (name: string) =>
            whiteListedNames === null ||
            (Array.isArray(whiteListedNames) && whiteListedNames.length === 0) ||
            whiteListedNames.includes(name)
        )
        .map((name: string) => this.getSingleton(name))
    )
  }

  public normalizeResources(nodes: any) {
    const existingImages: { [keys: string]: any } = {}
    const existingAssets: { [keys: string]: any } = {}
    const existingMarkdowns: { [keys: string]: any } = {}
    const existingLayouts: { [keys: string]: any } = {}

    nodes.forEach((node: any) => {
      node.items.forEach((item: any) => {
        this.normalizeNodeItemImages(item, existingImages)
        this.normalizeNodeItemAssets(item, existingAssets)
        this.normalizeNodeItemMarkdowns(item, existingImages, existingAssets, existingMarkdowns)
        this.normalizeNodeItemLayouts(item, existingImages, existingAssets, existingMarkdowns, existingLayouts)
      })
    })

    return {
      assets: existingAssets,
      images: existingImages,
      layouts: existingLayouts,
      markdowns: existingMarkdowns,
    }
  }

  private async getCollectionNames() {
    return this.fetch('/collections/listCollections', METHODS.GET)
  }

  private async getSingletonNames() {
    return this.fetch('/singletons/listSingletons', METHODS.GET)
  }

  private async getCollection(name: string) {
    const { fields: collectionFields, entries: collectionEntries } = await this.fetch(
      `/collections/get/${name}`,
      METHODS.GET
    )

    const collectionItems = collectionEntries.map((collectionEntry: any) =>
      createCollectionItem(name, collectionFields, collectionEntry)
    )

    for (const locale of this.locales) {
      const { fields: collectionFields, entries: collectionEntries } = await this.fetch(
        `/collections/get/${name}`,
        METHODS.GET,
        locale
      )

      collectionItems.push(
        ...collectionEntries.map((collectionEntry: any) =>
          createCollectionItem(name, collectionFields, collectionEntry, locale)
        )
      )
    }

    const officialName = this.aliases.collection[name] || name

    return { items: collectionItems, name: officialName }
  }

  private async getSingleton(name: string) {
    const singletonEntry = await this.fetch(`/singletons/get/${name}`, METHODS.GET)

    const singletonDescriptor = await this.fetch(`/singletons/singleton/${name}`, METHODS.GET)

    const singletonItems = [createSingletonItem(singletonDescriptor, singletonEntry)]

    for (const locale of this.locales) {
      const singletonEntry = await this.fetch(`/singletons/get/${name}`, METHODS.GET, locale)

      singletonItems.push(createSingletonItem(singletonDescriptor, singletonEntry, locale))
    }

    const officialName = this.aliases.singleton[name] || name

    return { items: singletonItems, name: officialName }
  }
  private async fetch(endpoint: string, method: string, lang?: string) {
    return request({
      json: true,
      method,
      uri: `${this.baseUrl}/api${endpoint}?token=${this.token}${lang ? `&lang=${lang}` : ''}`,
    })
  }

  private normalizeNodeItemImages(item: any, existingImages: any) {
    getFieldsOfTypes(item, ['image', 'gallery']).forEach(field => {
      if (!Array.isArray(field.value)) {
        const imageField = field
        let path = imageField.value.path

        if (path == null) {
          return
        }

        if (path.startsWith('/')) {
          path = `${this.baseUrl}${path}`
        } else if (!path.startsWith('http')) {
          path = `${this.baseUrl}/${path}`
        }

        imageField.value = path
        existingImages[path] = null
      } else {
        const galleryField = field

        galleryField.value.forEach((galleryImageField: any) => {
          let path = galleryImageField.path

          if (path == null) {
            return
          }

          trimGalleryImageField(galleryImageField)

          if (path.startsWith('/')) {
            path = `${this.baseUrl}${path}`
          } else if (!path.startsWith('http')) {
            path = `${this.baseUrl}/${path}`
          }

          galleryImageField.value = path
          existingImages[path] = null
        })
      }
    })

    if (Array.isArray(item.children)) {
      item.children.forEach((child: any) => {
        this.normalizeNodeItemImages(child, existingImages)
      })
    }
  }

  private normalizeNodeItemAssets(item: any, existingAssets: any) {
    getFieldsOfTypes(item, ['asset']).forEach(assetField => {
      let path = assetField.value.path

      trimAssetField(assetField)

      path = `${this.baseUrl}/storage/uploads${path}`

      assetField.value = path
      existingAssets[path] = null
    })

    if (Array.isArray(item.children)) {
      item.children.forEach((child: any) => {
        this.normalizeNodeItemAssets(child, existingAssets)
      })
    }
  }

  private normalizeNodeItemMarkdowns(item: any, existingImages: any, existingAssets: any, existingMarkdowns: any) {
    getFieldsOfTypes(item, ['markdown']).forEach(markdownField => {
      existingMarkdowns[markdownField.value] = null
      extractImagesFromMarkdown(markdownField.value, existingImages)
      extractAssetsFromMarkdown(markdownField.value, existingAssets)
    })

    if (Array.isArray(item.children)) {
      item.children.forEach((child: any) => {
        this.normalizeNodeItemMarkdowns(child, existingImages, existingAssets, existingMarkdowns)
      })
    }
  }

  private normalizeNodeItemLayouts(
    item: any,
    existingImages: any,
    existingAssets: any,
    existingMarkdowns: any,
    existingLayouts: any
  ) {
    getFieldsOfTypes(item, ['layout', 'layout-grid']).forEach(layoutField => {
      const stringifiedLayout = JSON.stringify(layoutField.value)
      const layoutHash = hash(stringifiedLayout)
      existingLayouts[layoutHash] = layoutField.value
      // TODO: this still needs to be implemented for layout fields
      // extractImagesFromMarkdown(markdownField.value, existingImages)
      // extractAssetsFromMarkdown(markdownField.value, existingAssets)
    })

    if (Array.isArray(item.children)) {
      item.children.forEach((child: any) => {
        this.normalizeNodeItemLayouts(child, existingImages, existingAssets, existingMarkdowns, existingLayouts)
      })
    }
  }
}

const trimAssetField = (assetField: any) => {
  delete assetField.value._id
  delete assetField.value.path
  delete assetField.value.title
  delete assetField.value.mime
  delete assetField.value.size
  delete assetField.value.image
  delete assetField.value.video
  delete assetField.value.audio
  delete assetField.value.archive
  delete assetField.value.document
  delete assetField.value.code
  delete assetField.value.created
  delete assetField.value.modified
  delete assetField.value._by

  Object.keys(assetField.value).forEach(attribute => {
    assetField[attribute] = assetField.value[attribute]
    delete assetField.value[attribute]
  })
}

const trimGalleryImageField = (galleryImageField: any) => {
  galleryImageField.type = 'image'

  delete galleryImageField.meta.asset
  delete galleryImageField.path
}

const createCollectionItem = (
  collectionName: string,
  collectionFields: any,
  collectionEntry: any,
  locale: string | null = null,
  level: number = 1
) => {
  const item: any = {
    cockpitBy: collectionEntry._by, // TODO: Replace with Users... once implemented (GitHub Issue #15)
    cockpitCreated: new Date(collectionEntry._created * 1000),
    cockpitId: collectionEntry._id,
    cockpitModified: new Date(collectionEntry._modified * 1000),
    cockpitModifiedBy: collectionEntry._mby,
    lang: locale == null ? 'any' : locale,
    level,
  }

  Object.keys(collectionFields).reduce((accumulator: any, collectionFieldName: string) => {
    const collectionFieldValue = collectionEntry[collectionFieldName]
    const collectionFieldConfiguration = collectionFields[collectionFieldName]
    const collectionFieldSlug = collectionEntry[`${collectionFieldName}_slug`]
    const field = createNodeField(
      'collection',
      collectionName,
      collectionFieldValue,
      collectionFieldConfiguration,
      collectionFieldSlug
    )

    if (field !== null) {
      accumulator[collectionFieldName] = field
    }

    return accumulator
  }, item)

  if (collectionEntry.hasOwnProperty('children')) {
    item.children = collectionEntry.children.map((childEntry: any) => {
      return createCollectionItem(collectionName, collectionFields, childEntry, locale, level + 1)
    })
  }

  return item
}

const createSingletonItem = (singletonDescriptor: any, singletonEntry: any, locale: string | null = null) => {
  const item = {
    cockpitBy: singletonEntry._by, // TODO: Replace with Users... once implemented (GitHub Issue #15)
    cockpitCreated: new Date(singletonDescriptor._created * 1000),
    cockpitId: singletonDescriptor._id,
    cockpitModified: new Date(singletonDescriptor._modified * 1000),
    cockpitModifiedBy: singletonEntry._mby,
    lang: locale == null ? 'any' : locale,
  }

  singletonDescriptor.fields.reduce((accumulator: any, singletonFieldConfiguration: any) => {
    const singletonFieldValue = singletonEntry[singletonFieldConfiguration.name]
    const singletonFieldSlug = singletonEntry[`${singletonFieldConfiguration.name}_slug`]
    const field = createNodeField(
      'singleton',
      singletonDescriptor.name,
      singletonFieldValue,
      singletonFieldConfiguration,
      singletonFieldSlug
    )

    if (field !== null) {
      accumulator[singletonFieldConfiguration.name] = field
    }

    return accumulator
  }, item)

  return item
}

const createNodeField = (
  nodeType: string,
  nodeName: string,
  nodeFieldValue: any,
  nodeFieldConfiguration: any,
  nodeFieldSlug?: string
) => {
  const nodeFieldType = nodeFieldConfiguration.type

  if (
    !(Array.isArray(nodeFieldValue) && nodeFieldValue.length === 0) &&
    nodeFieldValue != null &&
    nodeFieldValue !== ''
  ) {
    const itemField: any = {
      type: nodeFieldType,
    }

    if (nodeFieldType === 'repeater') {
      const repeaterFieldOptions = nodeFieldConfiguration.options || {}

      if (typeof repeaterFieldOptions.field !== 'undefined') {
        itemField.value = nodeFieldValue.map((repeaterEntry: any) =>
          createNodeField(nodeType, nodeName, repeaterEntry.value, repeaterFieldOptions.field)
        )
      } else if (typeof repeaterFieldOptions.fields !== 'undefined') {
        itemField.value = nodeFieldValue.map((repeaterEntry: any) =>
          repeaterFieldOptions.fields.reduce(
            (accumulator: any, currentFieldConfiguration: any) => {
              if (
                typeof currentFieldConfiguration.name === 'undefined' &&
                currentFieldConfiguration.label === repeaterEntry.field.label
              ) {
                const generatedNameProperty = slugify(currentFieldConfiguration.label, { lower: true })
                console.warn(
                  `\nRepeater field without 'name' attribute used in ${nodeType} '${nodeName}'. ` +
                    `Using value '${generatedNameProperty}' for name (generated from the label).`
                )
                currentFieldConfiguration.name = generatedNameProperty
                repeaterEntry.field.name = generatedNameProperty
              }

              if (currentFieldConfiguration.name === repeaterEntry.field.name) {
                accumulator.valueType = currentFieldConfiguration.name
                accumulator.value[currentFieldConfiguration.name] = createNodeField(
                  nodeType,
                  nodeName,
                  repeaterEntry.value,
                  currentFieldConfiguration
                )
              }

              return accumulator
            },
            { type: 'set', value: {} }
          )
        )
      }
    } else if (nodeFieldType === 'set') {
      const setFieldOptions = nodeFieldConfiguration.options || {}

      itemField.value = setFieldOptions.fields.reduce((accumulator: any, currentFieldConfiguration: any) => {
        const currentFieldName = currentFieldConfiguration.name
        accumulator[currentFieldName] = createNodeField(
          nodeType,
          nodeName,
          nodeFieldValue[currentFieldName],
          currentFieldConfiguration
        )

        return accumulator
      }, {})
    } else {
      itemField.value = nodeFieldValue

      if (nodeFieldSlug) {
        itemField.slug = nodeFieldSlug
      }
    }
    return itemField
  }

  return null
}

const extractImagesFromMarkdown = (markdown: any, existingImages: any) => {
  let unparsedMarkdown = markdown
  let match

  while ((match = MARKDOWN_IMAGE_REGEXP.exec(unparsedMarkdown))) {
    unparsedMarkdown = unparsedMarkdown.substring(match.index + match[0].length)
    existingImages[match[1]] = null
  }
}

const extractAssetsFromMarkdown = (markdown: any, existingAssets: any) => {
  let unparsedMarkdown = markdown
  let match

  while ((match = MARKDOWN_ASSET_REGEXP.exec(unparsedMarkdown))) {
    unparsedMarkdown = unparsedMarkdown.substring(match.index + match[0].length)
    const mediaType = getType(match[1])

    if (mediaType && mediaType !== 'text/html') {
      existingAssets[match[1]] = null
    }
  }
}
