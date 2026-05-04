import { defineCommand } from "citty";
import { runCheck } from "./check-runner";

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: "Compare two Bun lockfiles and print a markdown changelog",
  },
  args: {
    oldLockfile: {
      type: "positional",
      required: true,
      description: "Previous bun.lock file",
    },
    newLockfile: {
      type: "positional",
      required: true,
      description: "Current bun.lock file",
    },
    format: {
      type: "string",
      default: "markdown",
      description: "Report format to write to stdout or --output: markdown or html",
    },
    output: {
      type: "string",
      description:
        "Write the selected --format report to this file instead of stdout. Use - for stdout.",
    },
    htmlOutput: {
      type: "string",
      description:
        "Also write a standalone HTML report to this file while keeping primary output unchanged.",
    },
  },
  async run({ args }) {
    const exitCode = await runCheck({
      oldLockfilePath: args.oldLockfile,
      newLockfilePath: args.newLockfile,
      format: args.format,
      ...(args.output ? { output: args.output } : {}),
      ...(args.htmlOutput ? { htmlOutput: args.htmlOutput } : {}),
    });

    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  },
});
