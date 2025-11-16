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
  lang,
}: {
  word: string;
  scope: Scope;
  projectPath?: string;
  document: vscode.TextDocument;
  lang: string;
}) => {
  const args = ["add", word].concat(getArgs(scope, document));
  const runner = new SkyspellRunner({ projectPath, lang });
  await runner.run(args);
};

export const undo = async ({
  projectPath,
  lang,
}: {
  projectPath?: string;
  lang: string;
}) => {
  const runner = new SkyspellRunner({ projectPath, lang });
  await runner.run(["undo"]);
};

export class SkyspellRunner {
  projectPath: string | undefined;
  stdErr: string;
  stdOut: string;
  lang: string;

  constructor({ projectPath, lang }: { projectPath?: string; lang: string }) {
    this.projectPath = projectPath;
    this.stdErr = "";
    this.stdOut = "";
    this.lang = lang;
  }

  async run(args: string[]) {
    if (!this.projectPath) {
      return;
    }

    const baseArgs = ["--lang", this.lang, "--project-path", this.projectPath];
    const fullArgs = baseArgs.concat(args);

    const process = spawn("skyspell", fullArgs);

    process.stdout.on("data", (data) => {
      this.stdOut += data;
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
