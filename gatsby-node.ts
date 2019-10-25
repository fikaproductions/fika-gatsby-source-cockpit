import { copyFileSync } from 'fs'
import { join } from 'path'

import extendNodeType from './extend-node-type'
import CockpitServiceOld from './src/CockpitService'
import CollectionItemNodeFactory from './src/CollectionItemNodeFactory'
import { MARKDOWN_ASSET_REGEXP_GLOBAL, MARKDOWN_IMAGE_REGEXP_GLOBAL, TYPE_PREFIX_COCKPIT } from './src/constants'
import FileNodeFactory from './src/FileNodeFactory'
import LayoutNodeFactory from './src/LayoutNodeFactory'
import MarkdownNodeFactory from './src/MarkdownNodeFactory'
import SingletonItemNodeFactory from './src/SingletonItemNodeFactory'

import CockpitClient from './src/cockpit/client'
import CockpitService from './src/cockpit/service'

interface Aliases {
  collection: { [name: string]: string }
  singleton: { [name: string]: string }
}

interface Configuration {
  aliases: Aliases
  baseUrl: string
  brokenImageReplacementUrl: string
  collections: string[]
  locales: string[]
  singletons: string[]
  token: string
}

export const setFieldsOnGraphQLNodeType = extendNodeType

export const sourceNodes = async (
  { actions: { createNode }, reporter, cache, store }: import('gatsby').SourceNodesArgs,
  { aliases, baseUrl, brokenImageReplacementUrl, collections, locales, singletons, token }: Configuration
) => {
  const cockpitClient = new CockpitClient({
    baseUrl,
    collectionAliases: aliases.collection,
    locales,
    singletonAliases: aliases.singleton,
    token,
  })

  await cockpitClient.validateConnectionStatus()

  const cockpitService = new CockpitService({
    client: cockpitClient,
    whitelistedCollections: collections,
    whitelistedSingletons: singletons,
  })

  const entities = await cockpitService.getEntities()

  // OLD

  const cockpit = new CockpitServiceOld(baseUrl, token, locales, collections, singletons, aliases)
  const fileNodeFactory = new FileNodeFactory(createNode, store, cache, reporter)
  const markdownNodeFactory = new MarkdownNodeFactory(createNode)
  const layoutNodeFactory = new LayoutNodeFactory(createNode)

  const { images, assets, markdowns, layouts } = cockpit.normalizeResources(nodes)

  cache.set(TYPE_PREFIX_COCKPIT, nodes)

  const brokenImageReplacement = await createBrokenImagePlaceholder(fileNodeFactory, brokenImageReplacementUrl)

  for (const path of Object.keys(images)) {
    const imageNode = await fileNodeFactory.createImageNode(path)
    if (imageNode) {
      images[path] = {
        id: imageNode.id,
        localPath: copyFileToStaticFolder(imageNode),
      }
    } else if (brokenImageReplacement) {
      reporter.info('Using broken image replacement for missing image', path)
      images[path] = brokenImageReplacement
    }
  }

  for (const path of Object.keys(assets)) {
    const assetNode = await fileNodeFactory.createAssetNode(path)
    assets[path] = {
      id: assetNode.id,
      localPath: copyFileToStaticFolder(assetNode),
    }
  }

  for (const markdown of Object.keys(markdowns)) {
    const localMarkdown = updateAssetPathsWithLocalPaths(updateImagePathsWithLocalPaths(markdown, images), assets)
    const id = markdownNodeFactory.create(localMarkdown)
    markdowns[markdown] = { id }
  }

  for (const layout of Object.keys(layouts)) {
    const id = layoutNodeFactory.create(layouts[layout])
    layouts[layout] = { id }
  }

  collectionNodes.forEach((collectionNode: any) => {
    const nodeFactory = new CollectionItemNodeFactory(
      createNode,
      collectionNode.name,
      images,
      assets,
      markdowns,
      layouts
    )

    collectionNode.items.forEach((item: any) => {
      nodeFactory.create(item)
    })
  })

  singletonNodes.forEach((singletonNode: any) => {
    const nodeFactory = new SingletonItemNodeFactory(createNode, singletonNode.name, images, assets, markdowns, layouts)

    singletonNode.items.forEach((item: any) => {
      nodeFactory.create(item)
    })
  })
}

const copyFileToStaticFolder = ({
  absolutePath,
  name,
  ext,
  internal,
}: {
  absolutePath: string
  name: string
  ext: string
  internal: any
}) => {
  const localPath = join('/', 'static', `${name}-${internal.contentDigest}${ext}`)

  copyFileSync(absolutePath, join(process.cwd(), 'public', localPath))

  return localPath
}

const updateImagePathsWithLocalPaths = (markdown: string, images: any) => {
  return markdown.replace(MARKDOWN_IMAGE_REGEXP_GLOBAL, (...match) =>
    match[0].replace(match[1], images[match[1]].localPath)
  )
}

const updateAssetPathsWithLocalPaths = (markdown: string, assets: any) => {
  return markdown.replace(MARKDOWN_ASSET_REGEXP_GLOBAL, (...match) =>
    assets[match[1]] ? match[0].replace(match[1], assets[match[1]].localPath) : match[0]
  )
}

const createBrokenImagePlaceholder = async (fileNodeFactory: FileNodeFactory, placeholderUrl: string) => {
  const brokenImageReplacementUrl = placeholderUrl || null
  if (brokenImageReplacementUrl) {
    const brokenImageReplacementNode = await fileNodeFactory.createImageNode(brokenImageReplacementUrl)
    if (brokenImageReplacementNode) {
      const localPath = copyFileToStaticFolder(brokenImageReplacementNode)
      return {
        id: brokenImageReplacementNode.id,
        localPath,
      }
    }
  }
  return null
}

const validateNodeNames = (collectionNodes: any, singletonNodes: any) => {
  const collisions = Object.values(
    collectionNodes
      .map((collectionNode: any) => ({
        name: collectionNode.name,
        type: 'collection',
      }))
      .concat(
        singletonNodes.map((singletonNode: any) => ({
          name: singletonNode.name,
          type: 'singleton',
        }))
      )
      .reduce((accumulator: any, node: any) => {
        const key = node.name[0].toUpperCase() + node.name.substring(1)

        if (accumulator[key]) {
          accumulator[key].push(node)
        } else {
          accumulator[key] = [node]
        }

        return accumulator
      }, {})
  )
    .filter((association: any) => association.length > 1)
    .map((association: any) =>
      association.reduce(
        (accumulator: any, node: any) =>
          accumulator + (accumulator !== '' ? ' & ' : '') + `${node.name} (${node.type})`,
        ''
      )
    )

  if (collisions.length > 0) {
    throw new Error(
      `Some collections or singletons names are colliding,
       you must provide aliases for some of them in the plugin's configuration.` +
        '\n' +
        `An example for a collection and a singleton both named "team" would be:
        options: {
          …
          aliases: {
            singleton: {
              team: 'Team', // 'team' would be valid too
            },
            collection: {
              team: 'Teams', // 'teams' would be valid too
            }
          }
        }` +
        '\n' +
        'The colliding names are:\n' +
        collisions.reduce((accumulator, collision) => accumulator + '- ' + collision + '\n', '')
    )
  }
}
