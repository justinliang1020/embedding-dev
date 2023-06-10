"use client"
import Header from "@/components/Header";
import { useEffect, useRef, useState } from "react";
import { CollectionMetadata, ModelName, Query, RetrievalMethod } from "@/utils/utils";
import { Result } from "@/utils/utils";
export default function Lab() {
    const [model, setModel] = useState<ModelName>("text-embedding-ada-002")
    const [chunkSize, setChunkSize] = useState(1000);
    const [retrievalMethod, setRetrievalMethod] = useState<RetrievalMethod>("query-similarity")
    const [collectionId, setCollectionId] = useState("2c565f22-8f04-41eb-8c5b-de9b097718b9");
    const [collectionName, setCollectionName] = useState("us_wikipedia_page.txt");
    const [results, setResults] = useState<Result[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [queryContent, setQueryContent] = useState("");
    const [savingCollection, setSavingCollection] = useState(false);
    const [optionsChanged, setOptionsChanged] = useState(false);
    const [queryLoading, setQueryLoading] = useState(false);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        setOptionsChanged(true)
    }, [chunkSize, retrievalMethod, model, file])
    
    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files ? e.target.files[0] : null);
    };

    const onCollectionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSavingCollection(true);
        setOptionsChanged(false);
        const formData = new FormData();
        if (file) {
            setCollectionName(file.name);
            formData.append("file", file);
        }
        const collectionMetadata: CollectionMetadata = {
            embeddingModel: model,
            chunkSize: chunkSize,
            retrievalMethod: retrievalMethod,
            name: file ? file.name : "US Wikipedia Page",
        }
        formData.append("collectionMetadata", JSON.stringify(collectionMetadata))
        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });
        const data = await res.json() as { collectionId: string };
        setCollectionId(data.collectionId);
        setSavingCollection(false);
        console.log(data);
    };

    const onQuerySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setQueryLoading(true);
        const query: Query = {
            content: queryContent,
            collectionId: collectionId
        }
        const res = await fetch("/api/query", {
            method: "POST",
            body: JSON.stringify(query),

        });
        const data = await res.json();
        setQueryLoading(false);
        setResults(JSON.parse(data) as Result[]);
    };
    return (
        <div className="flex max-w-6xl mx-auto flex-col justify-center py-2 min-h-screen">
            <Header />
            <main className="grid grid-cols-3 flex-1 w-full items-center justify-center text-center px-4 mt-5 background-gradient">
                <div className="col-span-3 sm:col-span-1 sm:border-r-2 border-gray-900 p-6 h-full">
                    <h1 className="font-bold text-3xl mb-5">Collection Options</h1>
                    <form className="flex flex-col items-center space-y-4" onSubmit={onCollectionSubmit}>
                        <label className="tooltip" data-tip="Upload your own data! .txt .pdf">
                            <div>Data Source: <p className="font-bold">{collectionName}</p> </div>
                            <input type="file" onChange={onFileChange} className="file-input file-input-bordered file-input-sm w-full max-w-xs" />
                        </label>

                        <label>
                            Embedding Model
                            <select className="select select-bordered w-full max-w-xs" onChange={e => setModel(e.target.value as ModelName)}>
                                <option value="text-embedding-ada-002">text-embedding-ada-002 (OpenAI)</option>
                                {/* <option value="embed-english-v2.0">embed-english-v2.0 (Cohere)</option> */}
                                <option value="embedding-gecko-001">embedding-gecko-001 (Google Palm)</option>
                            </select>
                        </label>
                        <label>
                            Retrieval Method
                            <select className="select select-bordered w-full max-w-xs" onChange={e => setRetrievalMethod(e.target.value as RetrievalMethod)}>
                                <option value="query-similarity">Semantic Similarity</option>
                                <option value="hyde">HYDE</option>
                                {/* <option value="chunk-summarization">Chunk Summarization</option> */}
                            </select>
                        </label>
                        {/* add info tooltip */}
                        <label className="w-full tooltip" data-tip="Max characters in each document">
                            Chunk Size: {chunkSize}
                            <input type="range" min={100} max={2000} value={chunkSize} onChange={(e) => setChunkSize(parseInt(e.target.value))} className="range" step="100" />
                            <div className="w-full flex justify-between text-xs px-2">
                                <span>100</span>
                                <span>2000</span>
                            </div>
                        </label>
                        <button className="btn max-w-xs" disabled={savingCollection}>Save collection</button>
                        {optionsChanged ? "-- Unsaved options --" : ""}
                    </form>
                </div>
                <div className="flex flex-col col-span-2 w-full h-full">
                    <h1 className="text-2xl">Results:</h1>
                    <Carousel results={results} />
                    <form className="space-x-2" onSubmit={onQuerySubmit}>
                        <label>Query:</label>
                        <input type="text" className="input input-bordered" value={queryContent} onChange={e => setQueryContent(e.target.value)} />
                        <button className="btn btn-success" disabled={savingCollection || queryLoading}>Submit</button>
                    </form>
                </div>
            </main>
        </div>
    )
}

const Carousel = ({ results }: { results: Result[] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const length = results.length;
    useEffect(() => {
        setCurrentIndex(0);
    }, [results])

    const previousSlide = () => {
        setCurrentIndex((currentIndex - 1 + length) % length);
    }

    const nextSlide = () => {
        setCurrentIndex((currentIndex + 1) % length);
    }
    return (
        <div className="carousel w-full h-full items-center">
            {results.map((result, index) => (
                <div
                    key={index}
                    className={`carousel-item relative h-full w-full align-middle ${index === currentIndex ? 'block' : 'hidden'}`}
                >
                    <div className="absolute flex justify-between transform -translate-y-1/2 left-5 right-5 top-1/2">
                        <button onClick={previousSlide} className="btn btn-circle">❮</button>
                        <button onClick={nextSlide} className="btn btn-circle">❯</button>
                    </div>
                    <div>
                        {index + 1} / {length}
                    </div>
                    <div className="px-32 flex items-center justify-center h-full">
                        <p>
                            {result.content}
                            <p className="text-gray-500 pt-4">
                                Distance: {result.distance}
                            </p>
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};