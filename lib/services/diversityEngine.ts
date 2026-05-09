const HOOK_STYLES = [

    "question-based",

    "peaceful reflective",

    "benefit-led",

    "transformational",

    "gentle invitation"
];

const CTA_STYLES = [

    "warm invitation",

    "limited urgency",

    "peaceful encouragement",

    "community-focused",

    "self-care oriented"
];

const EMOJI_STYLES = [

    "minimal elegant emojis",

    "warm spiritual emojis",

    "nature-inspired emojis",

    "calm uplifting emojis"
];

function randomItem(
    items: string[]
) {

    return items[
        Math.floor(
            Math.random() * items.length
        )
    ];
}

export function buildDiversityInstructions() {

    const hookStyle =
        randomItem(HOOK_STYLES);

    const ctaStyle =
        randomItem(CTA_STYLES);

    const emojiStyle =
        randomItem(EMOJI_STYLES);

    return `
DIVERSITY REQUIREMENTS:
- Use a ${hookStyle} opening style
- Use a ${ctaStyle} CTA style
- Use ${emojiStyle}
- Ensure both generated messages feel meaningfully different
- Avoid repetitive sentence structures
- Avoid repeating identical emojis
- Avoid repeating identical hooks
`;
}