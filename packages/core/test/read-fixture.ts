import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readFixture(name: string): string {
  return readFileSync(join(import.meta.dir, "fixtures", "real-shaped", name), "utf8");
}
