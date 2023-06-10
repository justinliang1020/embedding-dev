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
          <div className="card-title justify-center link" >{name}</div>
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
            free tools to build with embeddings
            {/* <a href="https://docs.trychroma.com/embeddings" className="link font-extrabold">embedding models</a> */}
          </h1>
          <p>open-source, built on <a href="https://www.trychroma.com/" className="link">chroma</a></p>
        </div>
        <div className="flex flex-col sm:flex-row content-center space-y-2 flex-1 w-full items-center justify-center text-center px-4 mt-5 background-gradient">
          <ModuleCard name="playground" desc="Tinker with different embedding retrieval methods" image={UndrawCompare} />
          <ModuleCard name="eval" desc="coming soon..." image={UndrawScience} />
        </div>
      </main>
    </div>
  )
}