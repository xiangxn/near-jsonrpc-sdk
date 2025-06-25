export function snakeToCamel(str: string): string {
  const isExperimental = str.startsWith('EXPERIMENTAL_');
  const baseName = isExperimental ? str.replace('EXPERIMENTAL_', '') : str;
  const camelCase = baseName.replace(/(_\w)/g, (match) => match[1].toUpperCase());
  return isExperimental ? `EXPERIMENTAL_${camelCase}` : camelCase;
}

export function transformMethodNames<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map(transformMethodNames) as any;
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      snakeToCamel(key),
      transformMethodNames(value)
    ])
  ) as T;
}

export function clearPrefix(schemaCode: string) {
  const reg = /\bJsonRpcResponse_for_[A-Za-z0-9_]+\b/g;
  return schemaCode.replace(reg, (match) => {
    const name = match.replace(/^JsonRpcResponse_for_/, "");
    return snakeToCamel(name);
  })
}