import * as vscode from "vscode";
import Checker from "./checker";
import { ADD_WORD, SkyspellAction as SkyspellActions } from "./actions";
import { addWord, Scope, undo } from "./skyspell";

class State {
  projectPath?: string;
}

const state = new State();

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection("skyspell");
  context.subscriptions.push(diagnostics);

  const enableCommand = vscode.commands.registerCommand(
    "skyspell.enableSpellChecking",
    async () => {
      vscode.window.showInformationMessage("Spell checking enabled");

      const folders = vscode.workspace.workspaceFolders;
      if (folders) {
        const folder = folders[0];
        state.projectPath = folder.uri.fsPath;
      }

      await refreshDiagnostics();
    }
  );
  context.subscriptions.push(enableCommand);

  const addWordCommand = vscode.commands.registerCommand(
    ADD_WORD,
    async (document: vscode.TextDocument, word: string, scope: Scope) => {
      const { projectPath } = state;
      await addWord({ word, document, scope, projectPath });
      await refreshDiagnostics(document);
    }
  );
  context.subscriptions.push(addWordCommand);

  const undoCommand = vscode.commands.registerCommand(
    "skyspell.undo",
    async () => {
      const { projectPath } = state;
      await undo({ projectPath });
      await refreshDiagnostics();
    }
  );
  context.subscriptions.push(undoCommand);

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "markdown",
      new SkyspellActions(),
      {
        providedCodeActionKinds: SkyspellActions.providedCodeActionKinds,
      }
    )
  );

  const handleSave = async (doc: vscode.TextDocument) => {
    refreshDiagnostics(doc);
  };

  const refreshDiagnostics = async (document?: vscode.TextDocument) => {
    const { projectPath } = state;
    if (!projectPath) {
      return;
    }

    const actualDocument = document || vscode.window.activeTextEditor?.document;
    if (!actualDocument) {
      return;
    }

    const checker = new Checker({
      document: actualDocument,
      diagnostics,
      projectPath,
    });

    await checker.runSkyspell();
  };

  const handleClose = (doc: vscode.TextDocument) => {
    diagnostics.delete(doc.uri);
  };

  vscode.workspace.onDidSaveTextDocument(handleSave);
  vscode.workspace.onDidCloseTextDocument(handleClose);
}
