import * as vscode from 'vscode';
import * as path from 'path';
import { collectSealSecretUserInput } from './userInput';
import { sealSecretRaw, sealSecretFile } from './seal';
import { collectSealSecretDefaults } from './defaults';
import * as os from 'os';
import * as fs from 'fs';
import { ExtensionState } from './types';

let extensionState: ExtensionState = {
    kubeSealPath: undefined,
    sealSecretParams: undefined,
    localCert: true,
};

export function activate(context: vscode.ExtensionContext) {

    function initializeConfiguration() {
        const kubesealConfiguration = vscode.workspace.getConfiguration('kubeseal');
        const configuredKubeSealPath = kubesealConfiguration.get<string>('executablePath');
        const configuredLocalCert = kubesealConfiguration.get<boolean>('useLocalCertificate');
        extensionState.localCert = configuredLocalCert!;
        if (os.platform() === 'win32') {
            extensionState.kubeSealPath = configuredKubeSealPath || path.join(context.extensionPath, 'bin', 'kubeseal.exe');
        } else if (configuredKubeSealPath) {
            extensionState.kubeSealPath = configuredKubeSealPath;
        } else {
            vscode.window.showErrorMessage('kubeseal.executablePath not set');
        }

        if (!extensionState.kubeSealPath || !fs.existsSync(extensionState.kubeSealPath)) {
            vscode.window.showErrorMessage(`kubeseal.executablePath is set to ${extensionState.kubeSealPath} which does not exist`);
        }
    }

    initializeConfiguration();

    const configSubscription = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('kubeseal')) {
            initializeConfiguration();
        }
    });

    context.subscriptions.push(configSubscription);

    //
    // seal secret file
    //

    let sealKubeSecretFileCommand = vscode.commands.registerCommand('extension.sealKubeSecretFile', async () => {

        let editor = vscode.window.activeTextEditor;

        if (editor) {

            if (editor.document.isDirty || editor.document.isUntitled) {
                await vscode.commands.executeCommand('workbench.action.files.saveAs');
            }

            if (editor.document.isDirty || editor.document.isUntitled) {
                return; // user aborted save
            }

            if (!extensionState.kubeSealPath) {
                vscode.window.showErrorMessage(`kubeseal.executablePath is not set`);
                return;
            }

            const document = editor.document;
            extensionState.sealSecretParams = collectSealSecretDefaults(context, document, extensionState.sealSecretParams);
            extensionState.sealSecretParams = await collectSealSecretUserInput(context, extensionState.sealSecretParams, extensionState.localCert);

            if (!extensionState.kubeSealPath) {
                vscode.window.showErrorMessage(`kubeseal.executablePath is not set`);
                return;
            }

            try {
                const sealedSecret = await sealSecretFile(extensionState.kubeSealPath, document.fileName, extensionState.sealSecretParams, extensionState.localCert);
                const textDocument = await vscode.workspace.openTextDocument({ content: sealedSecret });
                if (textDocument) {
                    await vscode.window.showTextDocument(textDocument, { viewColumn: vscode.ViewColumn.Beside });
                }
            } catch (error) {
                vscode.window.showErrorMessage(String(error) || "An unknown error occurred");
            }
        }
    });

    context.subscriptions.push(sealKubeSecretFileCommand);

    //
    // seal secret selection
    //

    let sealKubeSecretSelectedTextCommand = vscode.commands.registerCommand('extension.sealKubeSecretSelectedText', async () => {
        const editor = vscode.window.activeTextEditor;

        if (editor) {

            if (!extensionState.kubeSealPath) {
                vscode.window.showErrorMessage(`kubeseal.executablePath is not set`);
                return;
            }

            const document = editor.document;
            const selections = editor.selections;

            extensionState.sealSecretParams = collectSealSecretDefaults(context, document, extensionState.sealSecretParams, false);
            extensionState.sealSecretParams = await collectSealSecretUserInput(context, extensionState.sealSecretParams, extensionState.localCert);

            for (const selection of selections) {
                const plainTextSecret = document.getText(selection);

                try {
                    const sealedSecret = await sealSecretRaw(extensionState.kubeSealPath, plainTextSecret, extensionState.sealSecretParams, extensionState.localCert);

                    editor.edit(editBuilder => {
                        editBuilder.replace(selection, sealedSecret);
                    });
                } catch (error) {
                    vscode.window.showErrorMessage(String(error) || "An unknown error occurred");
                }
            }
        }
    });

    context.subscriptions.push(sealKubeSecretSelectedTextCommand);
}

export function deactivate() {
}
