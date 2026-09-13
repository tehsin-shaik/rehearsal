import { brand } from "@/config/brand";

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center p-8">
      <section className="max-w-xl text-center">
        <h1 className="text-4xl font-semibold">{brand.productName}</h1>
        <p className="mt-4 text-slate-600">{brand.tagline}</p>
      </section>
    </main>
  );
}
