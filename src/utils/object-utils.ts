class ObjectUtils {
  /*
   * Returns a subset object containing only the related entries to a given key.
   * A related entry to a given key has a key which is prefixed with the given key's name followed by an underscore.
   * E.g. data: { total: 5, value: 'Hello world', value_slug: 'hello-world' }, key: value –> { slug: 'hello-world' }
   */
  public static getRelatedEntriesSubset(object: { [key: string]: any }, key: string): { [relatedKey: string]: any } {
    return Object.keys(object)
      .filter((currentKey: string) => currentKey.startsWith(`${key}_`))
      .map((currentKey: string) => currentKey.replace(`${key}_`, ''))
      .reduce((relatedEntriesSubset: { [relatedKey: string]: any }, relatedKey: string) => {
        relatedEntriesSubset[relatedKey] = object[`${key}_${relatedKey}`]
        return relatedEntriesSubset
      }, {})
  }
}

export default ObjectUtils
