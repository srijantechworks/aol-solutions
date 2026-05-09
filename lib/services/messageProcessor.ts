import {
    evaluateMessage
} from './evaluator';

import {
    generateMarketingMessages
} from './geminiGenerator';

import {
    parseMarketingResponse
} from './responseParser';

import {
    buildSelfHealingPrompt
} from './selfHealing';

import {
    prettyLog
} from './logger';

export async function processGeneratedMessages({

    rawOutput,

    copywriterPrompt

}: {

    rawOutput: string;

    copywriterPrompt: string;
}) {

    // ==========================================
    // PARSE
    // ==========================================

    const generatedMessages =
        parseMarketingResponse(
            rawOutput
        );

    // ==========================================
    // EVALUATE
    // ==========================================

    const evaluatedMessages =
        generatedMessages.map(
            (msg: any) => {

                const evaluation =
                    evaluateMessage(
                        msg.text
                    );

                return {
                    ...msg,
                    evaluation
                };
            }
        );

    prettyLog(
        "EVALUATED MESSAGES",
        evaluatedMessages
    );

    // ==========================================
    // FILTER PASSED
    // ==========================================

    const passedMessages =
        evaluatedMessages.filter(
            (msg: any) =>
                msg.evaluation.passed
        );

    let finalPassedMessages =
        passedMessages;

    // ==========================================
    // SELF HEALING
    // ==========================================

    if (
        passedMessages.length === 0
    ) {

        prettyLog(
            "SELF HEALING TRIGGERED",
            evaluatedMessages
        );

        const healingPrompt =
            buildSelfHealingPrompt({

                originalPrompt:
                    copywriterPrompt,

                failedMessages:
                    evaluatedMessages
            });

        const healedRawOutput =
            await generateMarketingMessages(
                healingPrompt
            );

        prettyLog(
            "SELF HEALED RAW OUTPUT",
            healedRawOutput
        );

        const healedMessages =
            parseMarketingResponse(
                healedRawOutput
            );

        const healedEvaluated =
            healedMessages.map(
                (msg: any) => {

                    const evaluation =
                        evaluateMessage(
                            msg.text
                        );

                    return {
                        ...msg,
                        evaluation
                    };
                }
            );

        const healedPassed =
            healedEvaluated.filter(
                (msg: any) =>
                    msg.evaluation.passed
            );

        if (
            healedPassed.length === 0
        ) {

            throw new Error(
                "Self-healing generation also failed"
            );
        }

        finalPassedMessages =
            healedPassed;
    }

    return finalPassedMessages;
}