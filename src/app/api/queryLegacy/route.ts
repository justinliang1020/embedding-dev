import { ChromaClient, CohereEmbeddingFunction, Collection, OpenAIEmbeddingFunction } from "chromadb";
import { Output, models } from "@/utils/utils";
import { NextResponse } from "next/server";
import { PalmEmbeddingFunction } from "@/utils/palm";
const client = new ChromaClient({
    path: `http://${process.env.CHROMA_SERVER_HOST}:${process.env.CHROMA_SERVER_HTTP_PORT}`
});

export async function POST(req: Request) {
    const body = await req.json();
    const query = body.query as string;
    if (process.env.OPENAI_API_KEY === undefined) {
        throw Error("no openai api key")
    }
    if (process.env.COHERE_API_KEY === undefined) {
        throw Error("no cohere api key")
    }
    if (process.env.PALM_API_KEY === undefined) {
        throw Error("no palm api key")
    }
    const res: { [key: string]: Output[] } = {};
    for (const model of models) {
        const collectionName = `${model.name}`
        let collection: Collection;
        switch (model.name) {
            case "text-embedding-ada-002":
                collection = await client.getCollection({
                    name: collectionName,
                    embeddingFunction: new OpenAIEmbeddingFunction({
                        openai_api_key: process.env.OPENAI_API_KEY
                    })
                })
                break;
            case "embed-english-v2.0":
                collection = await client.getCollection({
                    name: collectionName,
                    embeddingFunction: new CohereEmbeddingFunction({
                        cohere_api_key: process.env.COHERE_API_KEY
                    })
                })
                break;
            case "embedding-gecko-001":
                collection = await client.getCollection({
                    name: collectionName,
                    embeddingFunction: new PalmEmbeddingFunction(process.env.PALM_API_KEY),
                })
                break;
        }
        console.log(query);
        const queryResponse = await collection.query({
            queryTexts: query,
            nResults: 3,
        });
        const outputs: Output[] = [];
        if (queryResponse.documents[0] == null) {
            throw Error("n")
        }
        if (queryResponse.documents == null || queryResponse.distances == null) {
            throw Error("invalid query response")
        }
        for (let i = 0; i < queryResponse.documents[0].length; i++) {
            console.log(model, queryResponse.documents[0][i]);
            outputs.push({ text: queryResponse.documents[0][i], distance: queryResponse.distances[0][i] })
        }
        res[model.name] = outputs;
    }
    return new Response(JSON.stringify(res));
}