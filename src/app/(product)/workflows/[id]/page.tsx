import { notFound } from "next/navigation";
import { Workflows } from "@/ui/workflows/workflows";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { if ((await params).id !== "support-triage") notFound(); return <Workflows detail/>; }
