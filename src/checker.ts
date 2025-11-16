import * as vscode from "vscode";
import { SkyspellRunner } from "./skyspell";

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

export type SpellErrors = { [key: string]: SpellError[] };

export default class Checker {
  diagnostics: vscode.DiagnosticCollection;
  document: vscode.TextDocument;
  projectPath: string;
  stdError: string | null;

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
    this.stdError = null;
  }

  runSkyspell = async () => {
    const runner = new SkyspellRunner({ projectPath: this.projectPath });

    const args = ["check", "--non-interactive", "--output-format", "json"];

    if (this.document.fileName.endsWith("COMMIT_EDITMSG")) {
      args.push("--include-git-edit-message");
    }

    await runner.run(args);

    const errors: SpellErrors = JSON.parse(runner.stdOut);

    this.processErrors(errors);
  };

  processErrors(errors: SpellErrors) {
    this.diagnostics.clear();
    Object.entries(errors).forEach(([path, errorsForPath]) => {
      const uri = vscode.Uri.file(path);

      const diagnosticsForPath = errorsForPath.map((error) =>
        this.createDiagnostic(error)
      );

      this.diagnostics.set(uri, diagnosticsForPath);
    });
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
}
