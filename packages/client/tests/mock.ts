import {
    z,
    ZodTypeAny,
    ZodOptional,
    ZodNullable,
    ZodDefault,
    ZodEffects,
    ZodCatch,
    ZodLazy,
    ZodIntersection
} from 'zod';
import { generateMock } from '@anatine/zod-mock';
import { sharedState } from './setup';

export function unwrapZodType(schema: ZodTypeAny): ZodTypeAny {
    while (true) {
        if (
            schema instanceof ZodOptional ||
            schema instanceof ZodNullable ||
            schema instanceof ZodDefault ||
            schema instanceof ZodCatch
        ) {
            schema = schema._def.innerType;
        } else if (schema instanceof ZodLazy) {
            schema = schema._def.getter();
        } else if (schema instanceof ZodEffects) {
            schema = schema._def.schema;
        } else {
            break;
        }
    }
    return schema;
}

function generateMockBlockHeight(): number {
    const min = sharedState.latestBlockHeight! - 100;
    const max = sharedState.latestBlockHeight!;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMockSmart(schema: ZodTypeAny): any {
    schema = unwrapZodType(schema);

    if (schema instanceof z.ZodUnion) {
        console.log(1)
        const options = schema._def.options as ZodTypeAny[];

        for (const option of options) {
            const unwrapped = unwrapZodType(option);

            if (unwrapped instanceof z.ZodObject) {
                const shape = typeof unwrapped.shape === 'function' ? unwrapped.shape() : unwrapped.shape;
                const mockObj: Record<string, any> = {};

                for (const key in shape) {
                    const field = unwrapZodType(shape[key]);
                    if (key === 'block_id') {
                        mockObj[key] = generateMockBlockHeight();
                    } else if (key === 'shard_id') {
                        mockObj[key] = 0
                    } else if (field instanceof z.ZodEnum) {
                        mockObj[key] = field._def.values[0];
                    } else {
                        mockObj[key] = generateMock(field);
                    }
                }

                return mockObj;
            }
        }

        const randomIndex = Math.floor(Math.random() * options.length);
        return generateMock(unwrapZodType(options[randomIndex]));
    } else if (schema instanceof z.ZodObject) {
        console.log(2)
        const shape = typeof schema.shape === 'function' ? schema.shape() : schema.shape;
        const mockObj: Record<string, any> = {};

        for (const key in shape) {
            const field = unwrapZodType(shape[key]);
            if (key === 'block_id') {
                mockObj[key] = generateMockBlockHeight();
            } else if (key === 'shard_id') {
                mockObj[key] = 0
            } else if (field instanceof z.ZodEnum) {
                mockObj[key] = field._def.values[0];
            } else {
                mockObj[key] = generateMock(field);
            }
        }

        return mockObj;
    } else if(schema instanceof ZodIntersection) {
        console.log(3, typeof schema)
    }

    return generateMock(schema);
}
