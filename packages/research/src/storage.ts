import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatasetSchema, type AppRecord, type Dataset } from "@atlas/shared";

export function workspaceRoot(): string {
  return process.cwd();
}

export function runDirectory(runId: string): string {
  return path.join(workspaceRoot(), "data", "runs", runId);
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function acquireRunLock(runId: string): Promise<() => Promise<void>> {
  const lockPath = path.join(runDirectory(runId), ".lock");
  await mkdir(path.dirname(lockPath), { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, "wx");
    await handle.writeFile(`${process.pid}\n`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`Run ${runId} already has an active writer.`);
    throw error;
  }
  return async () => {
    await handle.close();
    await rm(lockPath, { force: true });
  };
}

export async function saveRecord(runId: string, stage: "baseline" | "verified", record: AppRecord): Promise<void> {
  await writeJsonAtomic(path.join(runDirectory(runId), stage, `${record.id.toString().padStart(3, "0")}-${record.slug}.json`), record);
}

export async function loadRecord(runId: string, stage: "baseline" | "verified", id: number, slug: string): Promise<AppRecord | null> {
  return readJson<AppRecord>(path.join(runDirectory(runId), stage, `${id.toString().padStart(3, "0")}-${slug}.json`));
}

export async function publishDataset(runId: string, records: AppRecord[]): Promise<Dataset> {
  const dataset = DatasetSchema.parse({ generatedAt: new Date().toISOString(), runId, model: "gpt-5.4-mini", records: [...records].sort((a, b) => a.id - b.id) });
  await writeJsonAtomic(path.join(workspaceRoot(), "data", "final", "apps.json"), dataset);
  return dataset;
}
