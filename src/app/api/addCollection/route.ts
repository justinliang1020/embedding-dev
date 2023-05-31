import { ChromaClient, OpenAIEmbeddingFunction, CohereEmbeddingFunction, Collection } from "chromadb";
import { models } from "@/utils/utils";
import { v4 } from "uuid";
import { PalmEmbeddingFunction } from "@/utils/palm";
function splitStringIntoChunks(str: string, chunkLength: number): string[] {
    const chunks: string[] = [];
    let currentPosition = 0;

    while (currentPosition < str.length) {
        const chunk = str.substring(currentPosition, currentPosition + chunkLength);
        chunks.push(chunk);
        currentPosition += chunkLength;
    }

    return chunks;
}
export async function POST(req: Request) {
    if (process.env.PROD == "true") {
        throw Error("no collection upload in prod")
    }
    const body = await req.json();
    // import chroma client, do text splitting, add documents to new collection, make a collection for each model
    const chunks = splitStringIntoChunks(body.text, 500);
    const client = new ChromaClient({
        path: `http://${process.env.CHROMA_SERVER_HOST}:${process.env.CHROMA_SERVER_HTTP_PORT}`
    });
    if (process.env.OPENAI_API_KEY === undefined) {
        throw Error("no openai api key")
    }
    if (process.env.COHERE_API_KEY === undefined) {
        throw Error("no cohere api key");
    }
    if (process.env.PALM_API_KEY === undefined) {
        throw Error("no palm api key");
    }
    // uncomment to reset db
    // client.reset();
    // return

    for (const model of models) {
        const collectionName = `${model.name}`;
        let collection: Collection;
        switch (model.name) {
            case "text-embedding-ada-002":
                collection = await client.getOrCreateCollection({
                    name: collectionName,
                    embeddingFunction: new OpenAIEmbeddingFunction({
                        openai_api_key: process.env.OPENAI_API_KEY,
                    })
                })
                break;
            case "embed-english-v2.0":
                collection = await client.getOrCreateCollection({
                    name: collectionName,
                    embeddingFunction: new CohereEmbeddingFunction({
                        cohere_api_key: process.env.COHERE_API_KEY,
                    })
                })
                break;
            case "embedding-gecko-001":
                collection = await client.getOrCreateCollection({
                    name: collectionName,
                    embeddingFunction: new PalmEmbeddingFunction(process.env.PALM_API_KEY),
                })
                break;
        }
        await collection.add({
            documents: chunks,
            ids: Array.from({ length: chunks.length }, () => v4())
        })
        console.log(await collection.query({
            query_text: "hello",
            n_results: 1,
        }))
    }
    console.log(await client.listCollections());
    return body;
} 