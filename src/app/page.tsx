"use client";
import { useForm, SubmitHandler } from "react-hook-form";
import { FormEvent, useState } from "react";
import { v4 as uuidv4, v4 } from "uuid";
import { Output, models } from "@/utils/utils";

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
    <main className="flex h-screen flex-col items-center space-y-5 p-24">
      <h1 className="text-4xl font-bold text-center">
        embedding.dev
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
              <h2 className="text-gray-500">{model.company}</h2>
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
      <footer className="space-x-12 justify-self-end pb-2">
        <a href="github.com" className="no-underline hover:underline text-blue-400">github</a>
        <a href="https://www.trychroma.com/" className="no-underline hover:underline text-blue-400">powered by chroma</a>
      </footer>
    </main>
  )
}
