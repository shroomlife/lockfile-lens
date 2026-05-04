#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { checkCommand } from "./commands/check";

const main = defineCommand({
  meta: {
    name: "lockfile-lens",
    version: "0.0.0",
    description: "Make bun.lock diffs human-reviewable.",
  },
  subCommands: {
    check: checkCommand,
  },
});

runMain(main);
