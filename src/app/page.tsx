"use client";
import { useForm, SubmitHandler } from "react-hook-form";
import { FormEvent, useState } from "react";
import { v4 as uuidv4, v4 } from "uuid";
import { Output, models } from "@/utils/utils";
import Header from "../components/Header";
export default function Home() {
  const [outputs, setOutputs] = useState<{ [key: string]: Output[] }>({})
  const [query, setQuery] = useState("");
  const makeApiCall = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const res = await fetch("api/query", {
      method: "POST",
      body: JSON.stringify({
        query: query
      })
    });
    setOutputs(await res.json());
  }
  return (
    <div className="flex max-w-6xl mx-auto flex-col items-center justify-center py-2 min-h-screen">
      <Header />
      <main className="flex flex-1 w-full flex-col items-center justify-center text-center px-4 mt-5 background-gradient">
        <h1 className="font-bold sm:text-3xl text-xl pb-4">
          Compare Embedding Models
        </h1>
        <form className="space-x-2" onSubmit={makeApiCall}>
          <input
            type="text"
            className="rounded-xl border-2 border-gray-300 p-4"
            placeholder="enter a query"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
            }}
          />
          <button className="rounded-xl border-2 border-gray-300 p-4 bg-gray-100">
            submit
          </button>
        </form>
        <p>
          current dataset: United States Wikipedia Page
        </p>
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
