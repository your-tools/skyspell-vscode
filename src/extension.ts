import { spawn } from "node:child_process";
import { once } from "node:events";
import * as vscode from "vscode";

type SpellRange = {
  line: number;
  start_column: number;
  end_column: number;
};

type SpellError = {
  word: string;
  range: SpellRange;
};

type State = { projectPath?: string };

const state: State = {};

class Checker {
  diagnostics: vscode.DiagnosticCollection;
  doc: vscode.TextDocument;
  errors: { [key: string]: SpellError[] };
  projectPath: string;
  stdErrr: string | null;

  constructor({
    doc,
    diagnostics,
    projectPath,
  }: {
    doc: vscode.TextDocument;
    diagnostics: vscode.DiagnosticCollection;
    projectPath: string;
  }) {
    this.projectPath = projectPath;
    this.doc = doc;
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
    Object.entries(this.errors).forEach(([path, errors]) => {
      errors.forEach((error) => {
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
        diagnostics.push(diagnostic);
      });
    });
    this.diagnostics.set(this.doc.uri, diagnostics);
  }

  onRunError(code: number) {
    let message = `Skyspell exited with code ${code}`;
    if (this.stdErrr != null) {
      message += "\n" + this.stdErrr;
    }
    vscode.window.showErrorMessage(message);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.enableSpellChecking",
    () => {
      vscode.window.showInformationMessage("Starting spell checking");

      const folders = vscode.workspace.workspaceFolders;
      if (folders) {
        const folder = folders[0];
        state.projectPath = folder.uri.fsPath;
      }
    }
  );

  const spellDiagnostics =
    vscode.languages.createDiagnosticCollection("skyspell");

  context.subscriptions.push(spellDiagnostics);

  const handleSave = async (doc: vscode.TextDocument) => {
    const { projectPath } = state;
    if (!projectPath) {
      return;
    }

    const checker = new Checker({
      doc,
      diagnostics: spellDiagnostics,
      projectPath,
    });

    await checker.runSkyspell();
  };

  vscode.workspace.onDidSaveTextDocument(handleSave);

  context.subscriptions.push(disposable);
}
