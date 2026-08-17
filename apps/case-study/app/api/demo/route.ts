import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { appSeeds, createUnresearchedRecord } from "@atlas/shared";
import { researchApp } from "@atlas/research";

export const runtime = "nodejs";
export const maxDuration = 60;

const github = appSeeds.find((seed) => seed.slug === "github")!;
if (!github) throw new Error("GitHub seed is missing.");

const cachedGithubResearch = unstable_cache(
  async () => researchApp(github),
  ["integration-readiness-atlas", "github", "gpt-5.4-mini", "v1"],
  { revalidate: 86_400, tags: ["github-demo"] }
);

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      mode: "unavailable",
      generatedAt: null,
      message: "A fresh run needs OPENAI_API_KEY. The committed dataset remains available below.",
      record: createUnresearchedRecord(github)
    }, { status: 503 });
  }

  try {
    const record = await cachedGithubResearch();
    return NextResponse.json({ mode: "fresh-or-24h-cache", generatedAt: record.researchedAt, message: "Returned the fixed GitHub research run.", record });
  } catch (error) {
    console.error("GitHub demo failed", error instanceof Error ? error.message : error);
    return NextResponse.json({
      mode: "error",
      generatedAt: null,
      message: "The GitHub run could not complete. Check server credentials, credit balance, and logs.",
      record: createUnresearchedRecord(github)
    }, { status: 502 });
  }
}
