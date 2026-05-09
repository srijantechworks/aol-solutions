type EvaluationResult = {

    score: number;

    passed: boolean;

    reasons: string[];
};

function countEmojis(
    text: string
) {

    const matches =
        text.match(
            /[^\w\s]/g
        );

    return matches?.length || 0;
}

function countLines(
    text: string
) {

    return text
        .split('\n')
        .filter(Boolean)
        .length;
}

function hasCTA(
    text: string
) {

    const lower =
        text.toLowerCase();

    return (
        lower.includes('register') ||
        lower.includes('join') ||
        lower.includes('book') ||
        lower.includes('spot') ||
        lower.includes('link')
    );
}

function hasHallucinationRisk(
    text: string
) {

    return (
        text.includes('100% guaranteed') ||
        text.includes('cure') ||
        text.includes('medically proven')
    );
}

export function evaluateMessage(
    text: string
): EvaluationResult {

    let score = 100;

    const reasons: string[] = [];

    const emojiCount =
        countEmojis(text);

    const lineCount =
        countLines(text);

    // ==========================================
    // TOO MANY EMOJIS
    // ==========================================

    if (emojiCount > 25) {

        score -= 15;

        reasons.push(
            "Too many emojis"
        );
    }

    // ==========================================
    // TOO FEW LINE BREAKS
    // ==========================================

    if (lineCount < 8) {

        score -= 20;

        reasons.push(
            "Poor WhatsApp formatting"
        );
    }

    // ==========================================
    // NO CTA
    // ==========================================

    if (!hasCTA(text)) {

        score -= 25;

        reasons.push(
            "Missing CTA"
        );
    }

    // ==========================================
    // HALLUCINATION RISK
    // ==========================================

    if (
        hasHallucinationRisk(text)
    ) {

        score -= 40;

        reasons.push(
            "Potential hallucination risk"
        );
    }

    return {

        score,

        passed:
            score >= 70,

        reasons
    };
}