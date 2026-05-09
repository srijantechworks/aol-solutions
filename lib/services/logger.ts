export const prettyLog = (title: string, data?: any) => {
    console.log("\n" + "=".repeat(80));
    console.log(`🔹 ${title}`);
    console.log("=".repeat(80));

    if (data !== undefined) {
        if (typeof data === "string") {
            console.log(
                data
                    .replace(/\r/g, " ")
                    .replace(/\n/g, "\n")
                    .replace(/\t/g, " ")
                    .replace(/\r/g, " ")
                    .replace(/[ ]{2,}/g, " ")
                    .trim()
            );
        } else {
            console.dir(data, { depth: null, colors: true });
        }
    }

    console.log("=".repeat(80) + "\n");
};