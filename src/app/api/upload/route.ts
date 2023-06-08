import { NextResponse } from "next/server";
import { PDFLoader } from "langchain/document_loaders/fs/pdf"
import { TextLoader } from "langchain/document_loaders/fs/text"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChromaClient, CohereEmbeddingFunction, IEmbeddingFunction, OpenAIEmbeddingFunction } from "chromadb";
import { CollectionMetadata } from "@/utils/utils";
import { v4 as uuid } from "uuid";
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

    const client = new ChromaClient({
        path: `http://${process.env.CHROMA_SERVER_HOST}:${process.env.CHROMA_SERVER_HTTP_PORT}`
    });
    const data = await req.formData();
    const file = data.get("file") as File;
    const collectionMetadata = JSON.parse(data.get("collectionMetadata") as string) as CollectionMetadata;
    let content = "";

    switch (file.type) {
        case "application/pdf":
            const pdfLoader = new PDFLoader(file, {
                splitPages: false
            });
            const pdfDocs = await pdfLoader.load();
            content = pdfDocs[0].pageContent;
            break;
        case "text/plain":
            const textLoader = new TextLoader(file);
            const textDocs = await textLoader.load();
            content = textDocs[0].pageContent;
            break;
        default:
            console.log('invalid pdf type')
            break;
    }
    console.log(collectionMetadata)
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
    }
    const collectionId = uuid();
    const collection = await client.createCollection({
        name: collectionId,
        metadata: collectionMetadata,
        embeddingFunction: embeddingFunction,
    });

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: collectionMetadata.chunkSize,
        chunkOverlap: collectionMetadata.chunkSize / 15, //MAGIC NUMBER
        separators: ["\n\n", "\n", " "]
    });
    // add chunks to collection
    // for chunk summarization, manually embed the documents using that technique
    // and use those embeddings to add to the collection

    const texts = await textSplitter.splitText(content);
    switch (collectionMetadata.retrievalMethod) {
        case "chunk-summarization":
            const summaries: string[] = [];
            //TODO: implement summaries
            const embeddings = await embeddingFunction.generate(texts);
            collection.add({
                ids: Array.from({ length: texts.length }, () => uuid()),
                documents: texts,
                embeddings: embeddings,
            })
            break;
        default:
            collection.add({
                ids: Array.from({ length: texts.length }, () => uuid()),
                documents: texts,
            })
            break;
    }
    console.log("texts length", texts.length)

    const results = await collection.query({
        queryTexts: "gaming",
        nResults: 1,
    });

    console.log('results', results);
    // split content and add to metadata
    return NextResponse.json({ "collectionId": collectionId })
}