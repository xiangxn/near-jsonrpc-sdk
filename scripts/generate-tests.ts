import { Project } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import prettier from 'prettier';

const sourceFilePath = 'packages/client/src/client.ts';
const outputDir = 'packages/client/tests';

const project = new Project();
const sourceFile = project.addSourceFileAtPath(sourceFilePath);

fs.mkdirSync(outputDir, { recursive: true });

const classDecl = sourceFile.getClassOrThrow('NearJsonRpcClient');
const methods = classDecl.getMethods();

methods.forEach(method => {
    const methodName = method.getName();
    const args = method.getParameters();

    if (args.length === 0) return;

    const paramType = args[0].getType().getText(); // types.XXX
    const bodyText = method.getBodyText() ?? '';
    const schemaMatch = bodyText.match(/,\s*schemas\.(\w+)\s*,\s*schemas\.(\w+)/);

    if (!schemaMatch) return;
    const [, inputSchema, outputSchema] = schemaMatch;

    const testCode = `
import { describe, it, expect } from 'vitest';
import { createApiClient } from '../src/client';
import { schemas } from '@near-js/jsonrpc-types';
import { generateMock } from '@anatine/zod-mock';
import { generateMockSmart } from './mock';

const client = createApiClient('https://test.rpc.fastnear.com');

describe('${methodName}', () => {
  it('should return data matching schema', async () => {
    const mockParams = generateMockSmart(schemas.${inputSchema});
    const result = await client.${methodName}(mockParams);
    const parsed = schemas.${outputSchema}.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});
`;

    const filePath = path.join(outputDir, `${methodName}.test.ts`);
    prettier.format(testCode, { parser: 'typescript' }).then(formatted => {
        fs.writeFileSync(filePath, formatted);
    })
});
