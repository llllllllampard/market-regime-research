import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const endpoint = process.env.SNAPSHOT_SOURCE_URL ?? "http://localhost:3000/api/analyze";
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    horizon: 60,
    question: "当前沪深300处于什么市场状态？主要矛盾和状态切换条件是什么？",
  }),
});

if (!response.ok) throw new Error(`Snapshot source returned HTTP ${response.status}`);
const payload = await response.json();
if (
  !payload?.ok
  || payload?.result?.snapshot?.mode !== "live"
  || !payload?.result?.snapshot?.indices?.HS300
  || !payload?.result?.snapshot?.breadth
) {
  throw new Error("Snapshot source did not return the required live datasets");
}

const outputDirectory = resolve("data");
const outputPath = resolve(outputDirectory, "market-snapshot.json");
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload.result.snapshot, null, 2)}\n`, "utf8");
console.log(`Captured truthful market snapshot at ${outputPath}`);
