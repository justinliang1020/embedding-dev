const modelNames = ["text-embedding-ada-002", "embed-english-v2.0", "embedding-gecko-001"] as const;
export type ModelName = typeof modelNames[number];
type Model = {
    name: ModelName;
    company: string;
    link: string;
}
export const models: Model[] = [
    { name: "text-embedding-ada-002", company: "openai", link: "https://platform.openai.com/docs/guides/embeddings"},
    { name: "embedding-gecko-001", company: "google", link: "https://developers.generativeai.google/tutorials/embed_node_quickstart"},
    { name: "embed-english-v2.0", company: "cohere", link: "https://docs.cohere.com/docs/embeddings"}
]
export type Output = {
    text: string;
    distance: number;
}
