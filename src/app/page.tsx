import Header from "@/components/Header"
import Image from "next/image"
import UndrawScience from "../../public/undraw_science_re_mnnr.svg"
import UndrawCompare from "../../public/undraw_split_testing_l1uw.svg"
import Link from "next/link"
function ModuleCard({ name, desc, image }: { name: string, desc: string, image: any }) {
  return (
    <Link className="card w-96 bg-base-100 shadow-xl mx-6" href={`/${name}`}>
      <>
        <figure className="h-60">
          <Image src={image} alt={name} />
        </figure>
        <div className="card-body">
          <div className="card-title justify-center link" >embedding.dev/{name}</div>
          <p>{desc}</p>
        </div>
      </>
    </Link>
  )
}
export default function Home() {
  return (
    <div className="flex max-w-6xl mx-auto flex-col justify-center py-2 min-h-screen">
      <Header />
      <main className="flex flex-col flex-1 w-full items-center justify-center text-center px-4 mt-5 background-gradient">
        <div>
          <h1 className="text-3xl font-bold">
            the toolkit to experiment with
            <br />
            embedding models
            {/* <a href="https://docs.trychroma.com/embeddings" className="link font-extrabold">embedding models</a> */}
          </h1>
          <p>free, open-source, built on <a href="https://www.trychroma.com/" className="link">chroma</a></p>
        </div>
        <div className="flex flex-row flex-1 w-full items-center justify-center text-center px-4 mt-5 background-gradient">
          <ModuleCard name="lab" desc="Craft the perfect text-embedding retriever (UNDER CONSTRUCTION)" image={UndrawScience} />
          <ModuleCard name="compare" desc="Compare multiple embedding models simultaneously" image={UndrawCompare} />
        </div>
      </main>
    </div>
  )
}