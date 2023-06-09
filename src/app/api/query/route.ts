import { NextResponse } from "next/server";
import { CollectionMetadata, Query, Result } from "@/utils/utils";
import { ChromaClient, CohereEmbeddingFunction, IEmbeddingFunction, OpenAIEmbeddingFunction } from "chromadb";
import { PalmEmbeddingFunction } from "@/utils/palm";

export async function POST(req: Request) {
    if (process.env.OPENAI_API_KEY === undefined) {
        throw Error("no openai api key")
    }
    if (process.env.COHERE_API_KEY === undefined) {
        throw Error("no cohere api key");
    }
    if (process.env.PALM_API_KEY === undefined) {
        throw Error("no palm api key");
    }

    const body = await req.json() as Query;
    const queryContent = body.content;
    const collectionId = body.collectionId;
    const client = new ChromaClient({
        path: `http://${process.env.CHROMA_SERVER_HOST}:${process.env.CHROMA_SERVER_HTTP_PORT}`
    });
    const collection = await client.getCollection({
        name: collectionId
    });
    const collectionMetadata = collection.metadata as CollectionMetadata;
    console.log("eoiwjrwoe", collectionMetadata)
    let embeddingFunction: IEmbeddingFunction;
    switch (collectionMetadata.embeddingModel) {
        case ("text-embedding-ada-002"):
            embeddingFunction = new OpenAIEmbeddingFunction({
                openai_api_key: process.env.OPENAI_API_KEY
            });
            break;
        case ("embed-english-v2.0"):
            embeddingFunction = new CohereEmbeddingFunction({
                cohere_api_key: process.env.COHERE_API_KEY
            });
            break;
        case ("embedding-gecko-001"):
            embeddingFunction = new PalmEmbeddingFunction(
                process.env.PALM_API_KEY,
            );
            break;
    };
    collection.embeddingFunction = embeddingFunction;
    const query = await collection.query({
        queryTexts: queryContent,
    });
    const results: Result[] = [];
    for (const document of query.documents[0]) {
        if (document !== null) {
            results.push({
                content: document,
                distance: 0.3,
            })
        }
    }
    console.log(results.length);
    return NextResponse.json(JSON.stringify(results));
}