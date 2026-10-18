const SAMPLE_POSITIONAL = ["John", "Smith", "Premium"];
const SAMPLE_NAMED: Record<string, string> = { name: "John", lastname: "Smith", product: "Premium" };

export function fillVariables(text: string, examples: string[] = []): string {
    return text
        .replace(/\{\{(\d+)\}\}/g, (match, index: string) => {
            const position = Number(index) - 1;
            return examples[position]?.trim() || SAMPLE_POSITIONAL[position] || match;
        })
        .replace(/\{\{([a-z_]+)\}\}/gi, (match, name: string) => SAMPLE_NAMED[name.toLowerCase()] ?? match);
}
