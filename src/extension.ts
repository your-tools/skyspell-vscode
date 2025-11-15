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

type State = {
  projectPath?: string;
  errors: { [key: string]: SpellError[] };
  stdErrr?: string;
};

class Checker {
  state: State;

  constructor() {
    this.state = { errors: {} };
  }

  runSkyspell = async (
    spellDiagnostics: vscode.DiagnosticCollection,
    doc: vscode.TextDocument
  ) => {
    const { projectPath } = this.state;
    if (!projectPath) {
      return;
    }

    const process = spawn("skyspell", [
      "--lang",
      "en_US",
      "--project-path",
      projectPath,
      "check",
      "--non-interactive",
      "--output-format",
      "json",
    ]);

    process.stdout.on("data", (data) => {
      this.state.errors = JSON.parse(data);
    });

    process.stderr.on("data", (data) => {
      this.state.stdErrr = data;
    });

    const [code] = await once(process, "close");

    this.onRunDone({ code, spellDiagnostics, doc });
  };

  onRunDone({
    code,
    spellDiagnostics,
    doc,
  }: {
    code: number;
    spellDiagnostics: vscode.DiagnosticCollection;
    doc: vscode.TextDocument;
  }) {
    if (code === 0) {
      this.onRunOk({ spellDiagnostics, doc });
    } else {
      this.onRunError(code);
    }
  }

  onRunOk({
    spellDiagnostics,
    doc,
  }: {
    spellDiagnostics: vscode.DiagnosticCollection;
    doc: vscode.TextDocument;
  }) {
    const { errors } = this.state;
    const diagnostics: vscode.Diagnostic[] = [];
    Object.entries(errors).forEach(([path, errors]) => {
      errors.forEach((error) => {
        const { range: spellRange, word } = error;
        const { line, start_column, end_column } = spellRange;

        const start = new vscode.Position(line - 1, start_column - 1);
        const end = new vscode.Position(line - 1, end_column - 1);
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
    spellDiagnostics.set(doc.uri, diagnostics);
  }

  onRunError(code: number) {
    let message = `Skyspell exited with code ${code}`;
    const { stdErrr } = this.state;
    if (stdErrr) {
      message += "\n" + stdErrr;
    }
    vscode.window.showErrorMessage(message);
  }
}

const checker = new Checker();

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.enableSpellChecking",
    () => {
      vscode.window.showInformationMessage("Starting spell checking");

      const folders = vscode.workspace.workspaceFolders;
      if (folders) {
        const folder = folders[0];
        checker.state.projectPath = folder.uri.fsPath;
      }
    }
  );

  const spellDiagnostics =
    vscode.languages.createDiagnosticCollection("skyspell");

  context.subscriptions.push(spellDiagnostics);

  const handleSave = async (doc: vscode.TextDocument) => {
    await checker.runSkyspell(spellDiagnostics, doc);
  };

  vscode.workspace.onDidSaveTextDocument(handleSave);

  context.subscriptions.push(disposable);
}
