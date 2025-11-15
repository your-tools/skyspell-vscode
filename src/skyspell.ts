import { spawn } from "child_process";
import { once } from "events";
import * as vscode from "vscode";

export type Scope = "project" | "file" | "extension";

const getArgs = (scope: Scope, document: vscode.TextDocument): string[] => {
  const path = document.uri.fsPath;

  if (scope === "project") {
    return ["--project"];
  }

  if (scope === "file") {
    return ["--relative-path", path];
  }

  if (scope === "extension") {
    const parts = path.split(".");
    const extension = parts[parts.length - 1];
    return ["--extension", extension];
  }

  return [];
};

export const addWord = async ({
  word,
  scope,
  projectPath,
  document,
}: {
  word: string;
  scope: Scope;
  projectPath?: string;
  document: vscode.TextDocument;
}) => {
  const args = ["add", word].concat(getArgs(scope, document));
  const runner = new SkyspellRunner({ projectPath });
  await runner.run(args);
};

export const undo = async ({ projectPath }: { projectPath?: string }) => {
  const runner = new SkyspellRunner({ projectPath });
  await runner.run(["undo"]);
};

export class SkyspellRunner {
  projectPath: string | undefined;
  stdErr: string;
  stdOut: string;

  constructor({ projectPath }: { projectPath?: string }) {
    this.projectPath = projectPath;
    this.stdErr = "";
    this.stdOut = "";
  }

  async run(args: string[]) {
    if (!this.projectPath) {
      return;
    }

    const baseArgs = ["--lang", "en_US", "--project-path", this.projectPath];
    const fullArgs = baseArgs.concat(args);

    const process = spawn("skyspell", fullArgs);

    process.stdout.on("data", (data) => {
      this.stdOut = data;
    });

    process.stderr.on("data", (data) => {
      this.stdErr = data;
    });

    const [code] = await once(process, "close");
    if (code !== 0) {
      console.error(`skyspell ${fullArgs.join(" ")} failed:\n${this.stdErr}`);
      vscode.window.showErrorMessage(
        `skyspell process failed with code ${code}`
      );
    }
  }
}
