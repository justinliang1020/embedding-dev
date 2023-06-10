import { NextResponse } from "next/server";
import { CollectionMetadata, Query, Result } from "@/utils/utils";
import { ChromaClient, CohereEmbeddingFunction, IEmbeddingFunction, OpenAIEmbeddingFunction } from "chromadb";
import { PalmEmbeddingFunction } from "@/utils/palm";
import { Configuration, OpenAIApi } from "openai";

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
    // console.log("eoiwjrwoe", collectionMetadata)
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

    const length = (await collection.get()).documents.length;
    // hyde
    let query;
    switch (collectionMetadata.retrievalMethod) {
        case "hyde":
            const openai = new OpenAIApi(new Configuration({
                apiKey: process.env.OPENAI_API_KEY,
            }));
            const prompt = `Write a paragraph that answers this question:
                ${queryContent}
                `
            const completion = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "user", content: prompt }
                ]
            });
            const content = completion.data.choices[0].message?.content;
            if (content === undefined) {
                throw ("error, openai api died")
            };
            query = await collection.query({
                queryTexts: content,
                nResults: Math.min(length, 10)
            });
            break;
        default:
            query = await collection.query({
                queryTexts: queryContent,
                nResults: Math.min(length, 10)
            })
            break;
    }
    // TODO: fix hack
    // const query = await collection.query({
    //     queryTexts: queryContent,
    //     nResults: Math.min(length, 10)
    // });
    const results: Result[] = [];
    if (query.distances === null) {
        throw ("no distances")
    }
    for (let i = 0; i < query.documents[0].length; i++) {
        const document = query.documents[0][i];
        const distance = query.distances[0][i];
        if (document === null) {
            throw ("null document")
        }
        results.push({
            content: document,
            distance: distance,
        })
    }

    // for (const document of query.documents[0]) {
    //     if (document !== null) {
    //         results.push({
    //             content: document,
    //             distance: 0.3,
    //         })
    //     }
    // }
    return NextResponse.json(JSON.stringify(results));
}