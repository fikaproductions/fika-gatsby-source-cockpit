import request from 'request-promise'

import Collection from './entities/collection'
import Singleton from './entities/singleton'

export interface EntryPayload extends JSONPayload {
  children?: EntryPayload[]
  _by: string
  _created: number
  _id: string
  _mby: string
  _modified: number
  _o?: number
  _pid?: string | null
}

export interface FieldPayload {
  acl?: string[]
  default?: string
  group?: string
  info?: string
  label?: string
  localize: boolean
  lst?: boolean
  name: string
  options: JSONPayload | []
  required?: boolean
  type: string
  width?: string
}

export interface CollectionPayload {
  entries: EntryPayload[]
  fields: { [name: string]: FieldPayload }
  total: number
}

export interface SingletonPayload extends Pick<EntryPayload, '_by' | '_mby'>, JSONPayload {}

export interface SingletonDescriptorPayload extends Pick<EntryPayload, '_created' | '_id' | '_modified'> {
  acl: JSONPayload | []
  color?: string
  data: null
  description: string
  fields: FieldPayload[]
  in_menu?: boolean
  label: string
  name: string
  template: string
}

interface JSONPayload {
  [keys: string]: any
}

interface CockpitClientArgs {
  baseUrl: string
  collectionAliases?: { [name: string]: string }
  locales: string[]
  singletonAliases?: { [name: string]: string }
  token: string
}

enum Method {
  GET = 'GET',
  POST = 'POST',
}

class CockpitClient {
  private baseUrl: string
  private collectionAliases: { [name: string]: string }
  private locales: string[]
  private singletonAliases: { [name: string]: string }
  private token: string

  constructor({ baseUrl, collectionAliases = {}, locales = [], singletonAliases = {}, token }: CockpitClientArgs) {
    this.baseUrl = baseUrl
    this.collectionAliases = collectionAliases
    this.locales = locales
    this.singletonAliases = singletonAliases
    this.token = token
  }

  public async validateConnectionStatus() {
    try {
      await this.fetch('', Method.GET)
    } catch {
      throw new Error('BaseUrl configuration parameter is invalid or there is no internet connection')
    }

    try {
      await this.getCollectionNames()
    } catch {
      throw new Error('Token configuration parameter is invalid')
    }
  }

  public async getCollectionNames(): Promise<string[]> {
    return this.fetch<string[]>('/collections/listCollections', Method.GET)
  }

  public async getSingletonNames(): Promise<string[]> {
    return this.fetch<string[]>('/singletons/listSingletons', Method.GET)
  }

  public async getCollection(name: string): Promise<Collection> {
    return new Collection({
      data: await this.internationalizedFetch<CollectionPayload>(`collections/get/${name}`, Method.GET),
      name: this.collectionAliases[name] || name,
    })
  }

  public async getSingleton(name: string): Promise<Singleton> {
    return new Singleton({
      data: await this.internationalizedFetch<SingletonPayload>(`/singletons/get/${name}`, Method.GET),
      metadata: await this.fetch<SingletonDescriptorPayload>(`singletons/singleton/${name}`, Method.GET),
      name: this.singletonAliases[name] || name,
    })
  }

  private async internationalizedFetch<T>(endpoint: string, method: Method): Promise<{ [lang: string]: T }> {
    const internationalizedPayloads = await Promise.all([
      this.fetch<T>(endpoint, method),
      ...this.locales.map((locale: string) => this.fetch<T>(endpoint, method, locale)),
    ])

    return internationalizedPayloads.slice(1).reduce(
      (map: { [lang: string]: T }, internationalizedPayload: T, index: number) => {
        map[this.locales[index]] = internationalizedPayload
        return map
      },
      { any: internationalizedPayloads[0] }
    )
  }

  private async fetch<T>(endpoint: string, method: Method, lang?: string): Promise<T> {
    const langQueryParam = lang ? `&lang=${lang}` : ''

    return request({
      json: true,
      method,
      uri: `${this.baseUrl}/api${endpoint}?token=${this.token}${langQueryParam}`,
    })
  }
}

export default CockpitClient
