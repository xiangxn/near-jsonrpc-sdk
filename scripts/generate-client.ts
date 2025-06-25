import { writeFileSync, readFileSync } from 'fs';
import { generateZodClientFromOpenAPI } from 'openapi-zod-client';
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { clearPrefix, snakeToCamel } from './utils';
import { format } from 'prettier';

async function generateClient() {

  const openApiDoc = (await SwaggerParser.parse("./openapi.json")) as OpenAPIObject;

  // Generate actual client
  const client = await generateZodClientFromOpenAPI({
    openApiDoc,
    templatePath: 'templates/client.hbs',
    disableWriteToFile: true,
    options: {
      withAlias: true,
      groupStrategy: 'tag'
    }
  });
  const methods = await generateClientMethods()
  const formattedMethods = await format(client.replace("{ClientMethods}", methods), { parser: 'typescript' });
  writeFileSync('packages/client/src/client.ts', formattedMethods);

  // Create index.ts
  const indexContent = `
    export * from './client';
  `;
  writeFileSync('packages/client/src/index.ts', indexContent);
}

async function generateClientMethods() {
  // Read OpenAPI JSON from local file
  const openApiContent = readFileSync("./openapi.json", 'utf-8');
  const openApiSpec = JSON.parse(openApiContent);

  // Read schemas.ts to get available schema names
  const schemasContent = readFileSync("packages/types/src/schemas.ts", 'utf-8');
  const schemaNames = new Set(
    schemasContent
      .match(/(\w+): z\./g)
      ?.map((match) => match.replace(/: z\./, '')) || []
  );
  // console.log('Available schema names in schemas.ts:', Array.from(schemaNames));

  const methodNames = Object.keys(openApiSpec.paths || {})
    .map((path) => {
      const methodName = path.split('/').pop();
      // Include snake_case, single-word, and EXPERIMENTAL_ methods
      if (methodName && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(methodName)) {
        const pathData = openApiSpec.paths[path];
        let inputSchemaName: string | undefined;
        let outputSchemaName: string | undefined;
        let paramTypeName: string | undefined;

        // Extract input schema from requestBody
        if (
          pathData.post?.requestBody?.content?.['application/json']?.schema
            ?.$ref
        ) {
          inputSchemaName =
            pathData.post.requestBody.content['application/json'].schema.$ref
              .split('/')
              .pop();
        }

        // Extract output schema from responses
        if (
          pathData.post?.responses?.['200']?.content?.['application/json']
            ?.schema?.$ref
        ) {
          outputSchemaName = pathData.post.responses['200'].content['application/json'].schema.$ref.split('/').pop();
          outputSchemaName = clearPrefix(outputSchemaName!);
        }

        if (openApiSpec.components.schemas[`JsonRpcRequest_for_${methodName}`]?.properties.params) {
          paramTypeName = openApiSpec.components.schemas[`JsonRpcRequest_for_${methodName}`]?.properties.params.$ref.split("/").pop()
        }

        return {
          rawMethod: methodName,
          isExperimental: methodName.startsWith('EXPERIMENTAL_'),
          inputSchemaName,
          outputSchemaName,
          paramTypeName
        };
      }
      return null;
    })
    .filter(
      (
        item
      ): item is {
        rawMethod: string;
        isExperimental: boolean;
        inputSchemaName: string | undefined;
        outputSchemaName: string | undefined;
        paramTypeName: string | undefined;
      } => !!item
    );

  if (methodNames.length === 0) {
    throw new Error('No JSON-RPC method names found in OpenAPI JSON.');
  }

  // Generate client methods
  const methods = methodNames.map(
    ({ rawMethod, isExperimental, inputSchemaName, outputSchemaName, paramTypeName }) => {
      const snakeCaseMethod = rawMethod;
      const camelCaseMethod = snakeToCamel(snakeCaseMethod);
      const baseMethodName = isExperimental
        ? rawMethod.replace('EXPERIMENTAL_', '')
        : rawMethod;
      const baseCamelCase = snakeToCamel(baseMethodName);

      // Try multiple schema name variations
      const inputSchemaNames = [
        inputSchemaName,
        `JsonRpcRequest_for_${snakeCaseMethod}`,
        `JsonRpcRequestFor${camelCaseMethod}`,
        `${camelCaseMethod}Request`,
        `${isExperimental ? 'EXPERIMENTAL_' : ''}${baseCamelCase}Request`,
        `${isExperimental ? 'EXPERIMENTAL_' : ''}${baseMethodName}_request`,
        snakeCaseMethod,
      ].filter((name): name is string => !!name);

      const outputSchemaNames = [
        outputSchemaName,
        `JsonRpcResponse_for_${snakeCaseMethod}`,
        `JsonRpcResponseFor${camelCaseMethod}`,
        `${camelCaseMethod}Response`,
        `${isExperimental ? 'EXPERIMENTAL_' : ''}${baseCamelCase}Response`,
        `${isExperimental ? 'EXPERIMENTAL_' : ''}${baseMethodName}_response`,
        snakeCaseMethod,
      ].filter((name): name is string => !!name);

      // Find matching schemas
      // const inputSchemaRef = inputSchemaNames.find((name) =>
      //   schemaNames.has(name)
      // );
      const outputSchemaRef = outputSchemaNames.find((name) =>
        schemaNames.has(name)
      );

      // Log missing schemas for debugging
      if (/*!inputSchemaRef || */!outputSchemaRef) {
        console.warn(
          `Schema not found for method: ${snakeCaseMethod}. Input attempted: ${inputSchemaNames.join(', ')}. Output attempted: ${outputSchemaNames.join(', ')}`
        );
      }

      // Use TypeScript type from types.ts for params
      const paramType = paramTypeName
        ? `${paramTypeName}`
        : 'any';

      const jsDoc = isExperimental ? ' /** Experimental method */' : '';

      return `
${jsDoc}
async ${camelCaseMethod}(params: types.${paramType}) {
  return this.request('${snakeCaseMethod}', params, ${paramTypeName ? `schemas.${paramType}` : 'undefined'}, ${outputSchemaRef ? `schemas.${outputSchemaRef}` : 'undefined'});
}`;
    }
  );

  return methods.join('\n');
}

generateClient().catch(console.error);