
import * as vscode from 'vscode';
import { exec } from 'child_process';


export default function checkProject() {
    console.log('hello ...');

    const diagnosticCollection = vscode.languages.createDiagnosticCollection();
    const diagnostics: vscode.Diagnostic[] =[];
    const pwd = process.cwd();

    const files : string[] = [];
    const textDocuments = vscode.workspace.textDocuments;
    textDocuments.forEach(doc => {
        if (doc.uri.scheme === "file") {
            files.push(doc.fileName);
        }
    });

    const skyspellErrors = new Map<string, vscode.Diagnostic[]>();
    const cmd = "skyspell --output-format json check --non-interactive " + files.join(' ');
    console.log(cmd);
    const skyspellProcess = exec(cmd, (error, stdout, stderr) => {
        if (error) {
            if (error.code !== 0) {
                vscode.window.showErrorMessage(`skyspell error: ${stderr}`);
            }
        }
        
        const jsonErrors = JSON.parse(stdout);
        for (let file in jsonErrors) {
            const uri = vscode.Uri.from( { scheme: "file", path: process.cwd() + '/' + file });
            const diagnostics = jsonErrors[file].map((e: any) => diagnosticFromJson(e));
            console.log(`setting diagnostics for uri: ${uri}`);
            diagnosticCollection.set(uri, diagnostics);
        }

    });

    skyspellProcess.on('exit', (code) => {
        console.log(`Child process exited with exit code ${code}`);
        if (code === 0) {
            vscode.window.showInformationMessage("skyspell: no errors found");
        }
    }); 
}

const diagnosticFromJson = (e: any) => {
    const start = new vscode.Position(e.range.line -1 , e.range.start_column -1);
    const end = new vscode.Position(e.range.line - 1, e.range.end_column);
    const range = new vscode.Range(start, end);
    const message = "Unknown word: " + e.word;
    return new vscode.Diagnostic(range, message);
};