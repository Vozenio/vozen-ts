/**
 * AskUserQuestion → bb question-shape helpers, shared by both herdr timeline
 * pipelines: the hand-written sessionLog.ts-based one (herdrThreadRegistry.ts,
 * still the source for non-claude agent kinds and as a safety net) and the
 * delta-translation.ts-based one (claudeTranscriptToTimelineRows.ts).
 *
 * Why this exists as its own module: bb's real vendored `tool-classification.ts`
 * does not special-case `AskUserQuestion` at all — it falls through to a
 * generic (suppressed) tool call, because bb's production UI surfaces a
 * question through a `PendingInteraction`, not a timeline row, and Claude's
 * own `toolUseResult.answers` metadata (keyed by question text) never
 * reaches a `ThreadEventItem` either (only its flattened text `result` does).
 * herdr has no equivalent out-of-band interaction channel for this, so both
 * pipelines keep rendering AskUserQuestion as its own "question" work row —
 * this is the one piece of knowledge with no vendored equivalent, kept in one
 * place instead of copied twice.
 */

/** Maps AskUserQuestion's own input shape (`{questions:[{question,header,
 * options:[{label,description}],multiSelect}]}`) onto bb's real
 * PendingInteractionUserQuestionQuestion schema. id/value formats
 * (`${toolUseId}:question-N`, `${questionId}:option-M`, both 1-indexed)
 * match bb's own real Claude Code bridge recordings
 * (provider-bridge-protocol/recordings/claude-code/user-question/*.ndjson)
 * — not invented. allowFreeText is unconditionally true there too (matches
 * the tool's own "Other" option). */
export function claudeAskUserQuestionToBbQuestions(toolUseId: string, input: Record<string, unknown>): Record<string, unknown>[] {
  const questions = Array.isArray(input.questions) ? input.questions : [];
  return questions.map((raw, index) => {
    const question = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const questionId = `${toolUseId}:question-${index + 1}`;
    const rawOptions = Array.isArray(question.options) ? question.options : [];
    const options = rawOptions.map((rawOption, optionIndex) => {
      const option = (rawOption && typeof rawOption === "object" ? rawOption : {}) as Record<string, unknown>;
      const label = typeof option.label === "string" ? option.label : `Option ${optionIndex + 1}`;
      return {
        value: `${questionId}:option-${optionIndex + 1}`,
        label,
        ...(typeof option.description === "string" ? { description: option.description } : {}),
      };
    });
    return {
      id: questionId,
      prompt: typeof question.question === "string" ? question.question : "",
      ...(typeof question.header === "string" ? { shortLabel: question.header } : {}),
      multiSelect: question.multiSelect === true,
      ...(options.length ? { options } : {}),
      allowFreeText: true,
    };
  });
}

/** Claude's own tool_result echoes `{questions, answers, annotations}` on
 * a successfully answered AskUserQuestion (a rejected one is instead the
 * plain string "User rejected tool use") — verified against this session's
 * own real transcript, not guessed. `answers` is keyed by the *original
 * question text*, not our synthetic id, and its value is always a single
 * string regardless of multiSelect: true in every real sample seen. Matches
 * that string against the question's own option labels to recover a
 * `selected` value id; anything that doesn't match becomes free text.
 * No real sample had multiSelect answered with more than one label, so a
 * multi-value answer isn't split — it falls through to free text, which is
 * an honest "don't know how to parse this" rather than a guessed split. */
export function claudeAskUserQuestionAnswers(
  resultMetadata: unknown,
  questions: Record<string, unknown>[],
): Record<string, unknown> | null {
  if (!resultMetadata || typeof resultMetadata !== "object") return null;
  const rawAnswers = (resultMetadata as Record<string, unknown>).answers;
  if (!rawAnswers || typeof rawAnswers !== "object") return null;
  const answersByQuestionText = rawAnswers as Record<string, unknown>;
  const answers: Record<string, unknown> = {};
  for (const question of questions) {
    const answer = answersByQuestionText[question.prompt as string];
    if (typeof answer !== "string") continue;
    const options = (question.options as Record<string, unknown>[] | undefined) ?? [];
    const matchedOption = options.find((option) => option.label === answer);
    answers[question.id as string] = matchedOption
      ? { selected: [matchedOption.value as string] }
      : { selected: [], freeText: answer };
  }
  return Object.keys(answers).length ? answers : null;
}
