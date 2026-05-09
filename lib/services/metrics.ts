type MetricEvent = {

    type: string;

    timestamp: string;

    metadata?: Record<string, any>;
};

export function trackMetric(
    type: string,
    metadata?: Record<string, any>
) {

    const event: MetricEvent = {

        type,

        timestamp:
            new Date().toISOString(),

        metadata
    };

    console.log(
        "📊 METRIC:",
        JSON.stringify(event)
    );
}