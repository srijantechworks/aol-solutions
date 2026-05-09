export function buildSelfHealingPrompt({

    originalPrompt,

    failedMessages

}: {

    originalPrompt: string;

    failedMessages: any[];
}) {

    const failureReasons =
        failedMessages
            .flatMap(
                (m: any) =>
                    m.evaluation?.reasons || []
            );

    const uniqueReasons =
        [...new Set(failureReasons)];

    return `
${originalPrompt}

IMPORTANT IMPROVEMENTS REQUIRED:

The previous generation failed quality evaluation.

Fix these issues carefully:

${uniqueReasons
    .map(
        reason => `- ${reason}`
    )
    .join('\n')}

ADDITIONAL REQUIREMENTS:
- Improve WhatsApp readability
- Ensure stronger CTA
- Improve formatting clarity
- Avoid repetitive structures
- Keep emotional warmth high
- Ensure messages feel human and uplifting

Generate fresh improved messages.
`;
}