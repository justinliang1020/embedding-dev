import { TextServiceClient } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";

export class PalmEmbeddingFunction {
    private api_key: string;
    private client: TextServiceClient;

    constructor(api_key: string) {
        this.api_key = api_key;
        this.client = new TextServiceClient({
            authClient: new GoogleAuth().fromAPIKey(this.api_key),
        });
    }

    public async generate(texts: string[]): Promise<number[][]> {
        const results: number[][] = [];
        for (const text of texts) {
            const result = await this.client.embedText({
                model: "models/embedding-gecko-001",
                text: text,
            });
            // bruh moment code
            results.push(JSON.parse(JSON.stringify(result))[0]["embedding"]["value"]);
        }
        return results
    }
}

