// Portable type declarations for `@get-bb/plugin-sdk`. Unpublished BB
// workspace contracts are flattened; public subpaths may reuse the
// package root without requiring any other @bb/* package.
//
// Confused by the API, or need a symbol that isn't here? Clone the BB repo
// and read the real source: https://github.com/get-bb/bb

import { z } from 'zod';

interface JsonObject {
    [key: string]: JsonValue;
}
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

/** Why a call did not produce a result; core's retry policy keys on it. */
declare const experimental_aiServiceErrorCodeSchema: z.ZodEnum<{
    auth_required: "auth_required";
    invalid_response: "invalid_response";
    rate_limited: "rate_limited";
    request_failed: "request_failed";
    service_unavailable: "service_unavailable";
    timeout: "timeout";
}>;
type ExperimentalAiServiceErrorCode = z.infer<typeof experimental_aiServiceErrorCodeSchema>;
declare const experimental_aiInferenceCompleteInputSchema: z.ZodObject<{
    model: z.ZodString;
    outputSchema: z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>;
    prompt: z.ZodString;
    reasoningEffort: z.ZodLiteral<"none">;
    serviceId: z.ZodString;
    timeoutMs: z.ZodNumber;
}, z.core.$strict>;
type ExperimentalAiInferenceCompleteInput = z.infer<typeof experimental_aiInferenceCompleteInputSchema>;
declare const experimental_aiInferenceCompleteOutputSchema: z.ZodUnion<readonly [z.ZodObject<{
    model: z.ZodString;
    ok: z.ZodLiteral<true>;
    value: z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>;
}, z.core.$strict>, z.ZodObject<{
    code: z.ZodEnum<{
        auth_required: "auth_required";
        invalid_response: "invalid_response";
        rate_limited: "rate_limited";
        request_failed: "request_failed";
        service_unavailable: "service_unavailable";
        timeout: "timeout";
    }>;
    message: z.ZodString;
    ok: z.ZodLiteral<false>;
}, z.core.$strict>]>;
type ExperimentalAiInferenceCompleteOutput = z.infer<typeof experimental_aiInferenceCompleteOutputSchema>;
declare const experimental_aiVoiceTranscribeInputSchema: z.ZodObject<{
    audioBase64: z.ZodString;
    filename: z.ZodString;
    mimeType: z.ZodString;
    model: z.ZodString;
    prompt: z.ZodNullable<z.ZodString>;
    serviceId: z.ZodString;
    timeoutMs: z.ZodNumber;
}, z.core.$strict>;
type ExperimentalAiVoiceTranscribeInput = z.infer<typeof experimental_aiVoiceTranscribeInputSchema>;
declare const experimental_aiVoiceTranscribeOutputSchema: z.ZodUnion<readonly [z.ZodObject<{
    model: z.ZodString;
    ok: z.ZodLiteral<true>;
    text: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    code: z.ZodEnum<{
        auth_required: "auth_required";
        invalid_response: "invalid_response";
        rate_limited: "rate_limited";
        request_failed: "request_failed";
        service_unavailable: "service_unavailable";
        timeout: "timeout";
    }>;
    message: z.ZodString;
    ok: z.ZodLiteral<false>;
}, z.core.$strict>]>;
type ExperimentalAiVoiceTranscribeOutput = z.infer<typeof experimental_aiVoiceTranscribeOutputSchema>;
/**
 * The host RPC methods an AI-service plugin implements. A plugin that
 * registers only `inference` still builds against the full contract; the
 * unregistered method may answer `{ ok: false, code: "request_failed" }`.
 */
declare const experimental_aiServicesHostContract: {
    readonly "ai.inference.complete": {
        readonly input: z.ZodObject<{
            model: z.ZodString;
            outputSchema: z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>;
            prompt: z.ZodString;
            reasoningEffort: z.ZodLiteral<"none">;
            serviceId: z.ZodString;
            timeoutMs: z.ZodNumber;
        }, z.core.$strict>;
        readonly output: z.ZodUnion<readonly [z.ZodObject<{
            model: z.ZodString;
            ok: z.ZodLiteral<true>;
            value: z.ZodType<JsonObject, unknown, z.core.$ZodTypeInternals<JsonObject, unknown>>;
        }, z.core.$strict>, z.ZodObject<{
            code: z.ZodEnum<{
                auth_required: "auth_required";
                invalid_response: "invalid_response";
                rate_limited: "rate_limited";
                request_failed: "request_failed";
                service_unavailable: "service_unavailable";
                timeout: "timeout";
            }>;
            message: z.ZodString;
            ok: z.ZodLiteral<false>;
        }, z.core.$strict>]>;
    };
    readonly "ai.voice.transcribe": {
        readonly input: z.ZodObject<{
            audioBase64: z.ZodString;
            filename: z.ZodString;
            mimeType: z.ZodString;
            model: z.ZodString;
            prompt: z.ZodNullable<z.ZodString>;
            serviceId: z.ZodString;
            timeoutMs: z.ZodNumber;
        }, z.core.$strict>;
        readonly output: z.ZodUnion<readonly [z.ZodObject<{
            model: z.ZodString;
            ok: z.ZodLiteral<true>;
            text: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            code: z.ZodEnum<{
                auth_required: "auth_required";
                invalid_response: "invalid_response";
                rate_limited: "rate_limited";
                request_failed: "request_failed";
                service_unavailable: "service_unavailable";
                timeout: "timeout";
            }>;
            message: z.ZodString;
            ok: z.ZodLiteral<false>;
        }, z.core.$strict>]>;
    };
};
type ExperimentalAiServicesHostContract = typeof experimental_aiServicesHostContract;

export { experimental_aiInferenceCompleteInputSchema, experimental_aiInferenceCompleteOutputSchema, experimental_aiServiceErrorCodeSchema, experimental_aiServicesHostContract, experimental_aiVoiceTranscribeInputSchema, experimental_aiVoiceTranscribeOutputSchema };
export type { ExperimentalAiInferenceCompleteInput, ExperimentalAiInferenceCompleteOutput, ExperimentalAiServiceErrorCode, ExperimentalAiServicesHostContract, ExperimentalAiVoiceTranscribeInput, ExperimentalAiVoiceTranscribeOutput };
