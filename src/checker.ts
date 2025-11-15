import { spawn } from "child_process";
import { once } from "events";
import * as vscode from "vscode";

export const DIAGNOSTIC_CODE = "skyspell-error";

type SpellRange = {
  line: number;
  start_column: number;
  end_column: number;
};

export type SpellError = {
  word: string;
  range: SpellRange;
};

export default class Checker {
  diagnostics: vscode.DiagnosticCollection;
  document: vscode.TextDocument;
  errors: { [key: string]: SpellError[] };
  projectPath: string;
  stdErrr: string | null;

  constructor({
    document,
    diagnostics,
    projectPath,
  }: {
    document: vscode.TextDocument;
    diagnostics: vscode.DiagnosticCollection;
    projectPath: string;
  }) {
    this.projectPath = projectPath;
    this.document = document;
    this.diagnostics = diagnostics;
    this.stdErrr = null;
    this.errors = {};
  }

  runSkyspell = async () => {
    const process = spawn("skyspell", [
      "--lang",
      "en_US",
      "--project-path",
      this.projectPath,
      "check",
      "--non-interactive",
      "--output-format",
      "json",
    ]);

    process.stdout.on("data", (data) => {
      this.errors = JSON.parse(data);
    });

    process.stderr.on("data", (data) => {
      this.stdErrr = data;
    });

    const [code] = await once(process, "close");

    this.onRunDone({ code });
  };

  onRunDone({ code }: { code: number }) {
    if (code === 0) {
      this.onRunOk();
    } else {
      this.onRunError(code);
    }
  }

  onRunOk() {
    const diagnostics: vscode.Diagnostic[] = [];
    Object.entries(this.errors).forEach(([_path, errors]) => {
      errors.forEach((error) => {
        const diagnostic = this.createDiagnostic(error);
        diagnostics.push(diagnostic);
      });
    });
    this.diagnostics.set(this.document.uri, diagnostics);
  }

  createDiagnostic(error: SpellError) {
    const { range: spellRange, word } = error;
    const { line, start_column, end_column } = spellRange;

    const start = new vscode.Position(line - 1, start_column - 1);
    const end = new vscode.Position(line - 1, end_column);
    const range = new vscode.Range(start, end);
    const diagnostic = new vscode.Diagnostic(
      range,
      `Unknown word: ${word}`,
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.source = "skyspell";
    diagnostic.code = DIAGNOSTIC_CODE;
    return diagnostic;
  }

  onRunError(code: number) {
    let message = `Skyspell exited with code ${code}`;
    if (this.stdErrr != null) {
      message += "\n" + this.stdErrr;
    }
    vscode.window.showErrorMessage(message);
  }
}
