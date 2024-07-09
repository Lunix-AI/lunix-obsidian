import {z, type ZodTypeAny} from "zod";
import {extendZodWithOpenApi, OpenApiGeneratorV3, OpenAPIRegistry} from "@asteasolutions/zod-to-openapi";
import type {FunctionParameters} from "~/types/openai";

extendZodWithOpenApi(z);

export function getParams<T extends ZodTypeAny>(params: T) : FunctionParameters {
	const registry = new OpenAPIRegistry();

	registry.register('params', params);

	return (new OpenApiGeneratorV3(registry.definitions).generateComponents().components?.schemas?.params ?? {}) as FunctionParameters;
}
