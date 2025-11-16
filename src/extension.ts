import * as vscode from "vscode";
import Checker, { Suggestions } from "./checker";
import SkyspellActions from "./actions";
import { addWord, Scope, undo } from "./skyspell";

export const ADD_WORD = "skyspell.addWord";
export const ENABLE = "skyspell.enable";
export const DISABLE = "skyspell.disable";
export const UNDO = "skyspell.undo";

export class Extension {
  context: vscode.ExtensionContext;
  diagnostics: vscode.DiagnosticCollection;
  projectPath: string | null;
  enabled: boolean;
  suggestions: Suggestions;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.projectPath = null;
    this.enabled = false;
    this.diagnostics = this.createDiagnostics();
    this.suggestions = {};
  }

  createDiagnostics() {
    const diagnostics = vscode.languages.createDiagnosticCollection("skyspell");
    this.context.subscriptions.push(diagnostics);
    return diagnostics;
  }

  registerCommands() {
    const enableCommand = vscode.commands.registerCommand(ENABLE, () =>
      this.enableSkyspell()
    );

    const disableCommand = vscode.commands.registerCommand(DISABLE, () =>
      this.disableSkyspell()
    );

    const addWordCommand = vscode.commands.registerCommand(
      ADD_WORD,
      (document: vscode.TextDocument, word: string, scope: Scope) =>
        this.addWord(document, word, scope)
    );

    const undoCommand = vscode.commands.registerCommand(UNDO, () =>
      this.undo()
    );

    [enableCommand, disableCommand, addWordCommand, undoCommand].forEach(
      (command) => this.context.subscriptions.push(command)
    );
  }

  registerActionProviders() {
    const selector: vscode.DocumentSelector = { scheme: "file" };
    const metadata: vscode.CodeActionProviderMetadata = {
      providedCodeActionKinds: SkyspellActions.providedCodeActionKinds,
    };
    const provider = new SkyspellActions(this);

    const actionsProvider = vscode.languages.registerCodeActionsProvider(
      selector,
      provider,
      metadata
    );
    this.context.subscriptions.push(actionsProvider);
  }

  registerEvents() {
    const onSave = vscode.workspace.onDidSaveTextDocument(
      (document: vscode.TextDocument) => this.handleSave(document)
    );
    const onClose = vscode.workspace.onDidCloseTextDocument(
      (document: vscode.TextDocument) => this.handleClose(document)
    );
    [onSave, onClose].forEach((event) =>
      this.context.subscriptions.push(event)
    );
  }

  async enableSkyspell() {
    vscode.window.showInformationMessage("Spell checking enabled");

    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
      const folder = folders[0];
      this.projectPath = folder.uri.fsPath;
    }

    this.enabled = true;
    await this.refreshDiagnostics();
  }

  async disableSkyspell() {
    vscode.window.showInformationMessage("Spell checking disabled");
    this.diagnostics.clear();
    this.enabled = false;
  }

  async addWord(document: vscode.TextDocument, word: string, scope: Scope) {
    if (!this.projectPath) {
      return;
    }

    await addWord({ word, document, scope, projectPath: this.projectPath });
    await this.refreshDiagnostics(document);
  }

  async undo() {
    if (!this.projectPath) {
      return;
    }

    await undo({ projectPath: this.projectPath });
    await this.refreshDiagnostics();
  }

  async handleSave(_document: vscode.TextDocument) {
    if (this.enabled) this.refreshDiagnostics();
  }

  async handleClose(document: vscode.TextDocument) {}

  refreshDiagnostics = async (document?: vscode.TextDocument) => {
    if (!this.projectPath) {
      return;
    }

    const actualDocument = document || vscode.window.activeTextEditor?.document;
    if (!actualDocument) {
      return;
    }

    const checker = new Checker({
      document: actualDocument,
      diagnostics: this.diagnostics,
      projectPath: this.projectPath,
      extension: this,
    });

    await checker.runSkyspell();
  };
}

export function activate(context: vscode.ExtensionContext) {
  const extension = new Extension(context);
  extension.registerCommands();
  extension.registerActionProviders();
  extension.registerEvents();
}
