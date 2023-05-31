import { ChromaClient, CohereEmbeddingFunction, Collection, OpenAIEmbeddingFunction } from "chromadb";
import { Output, models } from "@/utils/utils";
import { NextResponse } from "next/server";
import { PalmEmbeddingFunction } from "@/utils/palm";
const client = new ChromaClient({

    path: `http://${process.env.CHROMA_SERVER_HOST}:${process.env.CHROMA_SERVER_HTTP_PORT}`
});

function zip<T, U>(list1: T[], list2: U[]): [T, U][] {
    const zipped: [T, U][] = [];
    const length = Math.min(list1.length, list2.length);

    for (let i = 0; i < length; i++) {
        zipped.push([list1[i], list2[i]]);
    }

    return zipped;
}

export async function POST(req: Request) {
    const body = await req.json();
    const query = body.query;
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
        const queryResponse = await collection.query({
            query_text: query,
            n_results: 3,
        })
        // console.log(queryResponse);
        const outputs: Output[] = [];
        if (queryResponse.documents[0] == null) {
            throw Error("n")
        }
        for (const document of queryResponse.documents[0]) {
            outputs.push({text: document})
        }
        res[model.name]=outputs;
    }
    console.log(res);
    return new Response(JSON.stringify(res));
}