type RankInput = {

    messages: any[];

    prefs: {
        audience?: string;
        tone?: string;
        benefit?: string;
    };
};

function calculateKeywordScore(
    text: string,
    keywords: string[]
) {

    const lower =
        text.toLowerCase();

    let score = 0;

    for (const keyword of keywords) {

        if (
            lower.includes(
                keyword.toLowerCase()
            )
        ) {
            score += 1;
        }
    }

    return score;
}

export function rankHistoricalMessages({
    messages,
    prefs
}: RankInput) {

    if (!messages?.length) {
        return [];
    }

    const audienceKeywords =
        prefs.audience
            ?.split(' ')
            || [];

    const benefitKeywords =
        prefs.benefit
            ?.split(' ')
            || [];

    const toneKeywords =
        prefs.tone
            ?.split(' ')
            || [];

    const ranked =
        messages.map((msg: any) => {

            const text =
                String(
                    msg.message_text || ''
                );

            const engagement =
                Number(
                    msg.engagement_score || 0
                );

            const audienceScore =
                calculateKeywordScore(
                    text,
                    audienceKeywords
                );

            const benefitScore =
                calculateKeywordScore(
                    text,
                    benefitKeywords
                );

            const toneScore =
                calculateKeywordScore(
                    text,
                    toneKeywords
                );

            const totalScore =
                (
                    engagement * 5
                ) +
                (
                    audienceScore * 3
                ) +
                (
                    benefitScore * 4
                ) +
                (
                    toneScore * 2
                );

            return {
                ...msg,
                ranking_score:
                    totalScore
            };
        });

    return ranked
        .sort(
            (a, b) =>
                b.ranking_score -
                a.ranking_score
        )
        .slice(0, 5);
}