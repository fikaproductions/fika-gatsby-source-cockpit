class ArrayUtils {
  public static isEmptyArray(value: any): boolean {
    return Array.isArray(value) && value.length === 0
  }
}

export default ArrayUtils
