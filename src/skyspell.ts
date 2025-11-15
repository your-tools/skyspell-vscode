import { spawn } from "child_process";
import { once } from "events";
import * as vscode from "vscode";

export type Scope = "global" | "project" | "file";

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
  if (!projectPath) {
    return;
  }

  const args = ["--lang", "en_US", "--project-path", projectPath, "add", word];

  switch (scope) {
    case "global": {
      break;
    }
    case "project": {
      args.push("--project");
    }
    case "file": {
      args.push("--relative-path", document.uri.fsPath);
    }
  }

  const process = spawn("skyspell", args);
  const [code] = await once(process, "close");

  if (code !== 0) {
    console.error("process failed", args);
  }
};
