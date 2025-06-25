import { writeFileSync } from 'fs';
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { generateZodClientFromOpenAPI } from 'openapi-zod-client';
import Handlebars from 'handlebars';
import { clearPrefix } from './utils';
import { format } from 'prettier';


const hbs = Handlebars.create();
hbs.registerHelper('isComplex', function (schemaCode: string) {
  const fieldCount = (schemaCode.match(/z\.(string|number|object|array|boolean)/g) || []).length;
  const objectDepth = (schemaCode.match(/z\.object/g) || []).length;
  return fieldCount > 10 || objectDepth > 3;
});

hbs.registerHelper('or', function (a: any, b: any) {
  return !!a || !!b;
});

hbs.registerHelper('filterPrefix', function (key: string, options: any) {
  return key.startsWith("JsonRpcRequest_for_") === false
});

hbs.registerHelper('fixDesc', function (schemaCode: string) {
  schemaCode = schemaCode.replace(/(=)\s*\/\*\*[\s\S]*?\*\/\s*/g, "$1 ")
  schemaCode = schemaCode.replace(/(\w+\??:\s*)\/\*\*([\s\S]*?)\*\/\s*([^\n;]+[;]?)/g, (_match, prop, comment, type) => {
    return `/**${comment}*/\n${prop}${type}`;
  })
  return clearPrefix(schemaCode);
});

hbs.registerHelper('clearPrefix', clearPrefix);

async function generateTypes() {

  const openApiDoc = (await SwaggerParser.parse("./openapi.json")) as OpenAPIObject;

  hbs.registerHelper('description', function (key: string) {
    if (openApiDoc.components && openApiDoc.components.schemas) {
      const obj = openApiDoc.components.schemas[key]
      if ("description" in obj) {
        return `/**\n${obj.description}\n*/`
      }
    }
    return ""
  })

  // Generate TypeScript types and Zod schemas
  const types = await generateZodClientFromOpenAPI({
    openApiDoc,
    handlebars: hbs,
    templatePath: "./templates/types.hbs",
    disableWriteToFile: true, // Prevent automatic file writing
    options: {
      withAlias: true,
      withDocs: true,
      exportSchemas: true,
      shouldExportAllTypes: true,
      shouldExportAllSchemas: true
    },
  });
  const formattedTypes = await format(types, { parser: 'typescript' });
  writeFileSync('packages/types/src/types.ts', formattedTypes);

  // Generate TypeScript types and Zod schemas
  let schemas = await generateZodClientFromOpenAPI({
    openApiDoc,
    handlebars: hbs,
    templatePath: "./templates/schemas.hbs",
    disableWriteToFile: true, // Prevent automatic file writing
    options: {
      withAlias: true,
      withDocs: true,
      exportSchemas: true,
      shouldExportAllTypes: true,
      shouldExportAllSchemas: true,
    },
  });
  schemas = schemas.replace("z.lazy(() =>", "z.lazy((): z.ZodType<any> =>")
  schemas = schemas.replace("shards_parent_map: null,", "shards_parent_map: undefined,")
  schemas = schemas.replace("shards_split_map: null,", "shards_split_map: undefined,")
  const formattedSchemas = await format(schemas, { parser: 'typescript' });
  writeFileSync('packages/types/src/schemas.ts', formattedSchemas);

  // Create index.ts
  const indexContent = `
    export * as types from './types';
    export * as schemas from './schemas';
  `;
  writeFileSync('packages/types/src/index.ts', indexContent);
}

generateTypes().catch(console.error);