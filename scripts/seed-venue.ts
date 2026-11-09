// Loads the demo venue (rooms + meeting spots) with geo_point locations.
// x/y meters on the floor plan are converted to lat/lon around the venue.
import { readFileSync } from "node:fs";
import { Client } from "@elastic/elasticsearch";

try { process.loadEnvFile(".env"); } catch { /* use the real environment */ }

const es = new Client({ node: process.env.ES_URL!, auth: process.env.ES_API_KEY ? { apiKey: process.env.ES_API_KEY } : undefined });

interface Spot { id: string; name: string; kind: string; x: number; y: number; w: number; h: number; capacity: number; live_count: number }

async function main() {
  const venue = JSON.parse(readFileSync("data/venue.json", "utf8")) as { origin: { lat: number; lon: number }; spots: Spot[] };
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((venue.origin.lat * Math.PI) / 180);
  const ops = venue.spots.flatMap((s) => [
    { index: { _index: "sidecar-venue", _id: s.id } },
    { ...s, location: { lat: venue.origin.lat - s.y / mPerDegLat, lon: venue.origin.lon + s.x / mPerDegLon } },
  ]);
  const res = await es.bulk({ operations: ops, refresh: true });
  if (res.errors) throw new Error(JSON.stringify(res.items.find((i) => i.index?.error)?.index?.error));
  console.log(`seeded venue: ${venue.spots.length} rooms and meeting spots`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
