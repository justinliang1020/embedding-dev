"use client";
import { useForm, SubmitHandler } from "react-hook-form";
import { FormEvent, useState } from "react";
import { v4 as uuidv4, v4 } from "uuid";
import { Output, models } from "@/utils/utils";
import Header from "../../components/Header";
export default function Compare() {
    const [outputs, setOutputs] = useState<{ [key: string]: Output[] }>({})
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const makeApiCall = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        const res = await fetch("api/query", {
            method: "POST",
            body: JSON.stringify({
                query: query
            })
        });
        setOutputs(await res.json());
        setTimeout(() => {
            setLoading(false);
        }, 100);
    }
    return (
        <div className="flex max-w-6xl mx-auto flex-col justify-center py-2 min-h-screen">
            <Header />
            <main className="flex flex-col flex-1 w-full items-center justify-center text-center px-4 mt-5 background-gradient">
                {/* <main className="grid grid-cols-3 h-full"> */}
                <h1 className="font-bold sm:text-3xl text-xl pb-4">
                    Compare Embedding Models
                </h1>
                <div className="pb-2">
                    current document: United States Wikipedia Page

                </div>
                <form className="space-x-2 pb-2" onSubmit={makeApiCall}>
                    <input
                        type="text"
                        className="input input-bordered"
                        placeholder="enter a query"
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value)
                        }}
                    />
                    {!loading && (
                        <button className="btn">Submit</button>
                    )}
                    {loading && (
                        <button disabled className="btn align-middle">
                            <span className="loading loading-spinner loading-md"></span>
                        </button>
                    )}
                </form>
                <div className="flex-initial">
                    {models.map((model) => (
                        <div key={model.name} className="flex gap-6 tracking-wide mb-10">
                            <div className="items-center h-max align-middle">
                                <h2 className="text-gray-500 text-center">{model.company}</h2>
                                <h1 className="font-bold text-xl text-gray-950">{model.name}</h1>
                                <a href={model.link} className="font-medium text-blue-600 dark:text-blue-500 hover:underline">Read more</a>
                            </div>
                            <div className="flex gap-2">
                                {outputs[model.name]?.map((output) => (
                                    <div key={v4()} className="border-2 border-gray-800 rounded-xl p-2">
                                        {output.text}
                                        <div className="text-center text-gray-500 p-2">
                                            Distance: {output.distance}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    )
}