// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
//import { stringify } from 'querystring';
import { collectSealSelectedTextUserInput } from './userInput';
import { sealSecretRaw, sealSecretFile } from './seal';
import { collectSealSelectedTextDefaults } from './defaults';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "collector-kubeseal" is now active!');
	
	function getKubesealExectutablePath() : string {
		// TODO: implement a more refined strategy
		const kubesealConfiguration = vscode.workspace.getConfiguration('kubeseal');
		console.log("kubesealConfiguration", kubesealConfiguration)
		let kubeSealPath : string = kubesealConfiguration.get<string>('executablePath') || path.join(context.extensionPath, 'bin', 'kubeseal.exe');
		console.log("kubeSealPath", kubeSealPath)
		return kubeSealPath;
	}

	let sealKubeSecretFileCommand = vscode.commands.registerCommand('extension.sealKubeSecretFile', async () => {
		let editor = vscode.window.activeTextEditor;

		if (editor) {
			let document = editor.document;
			const kubesealPath = getKubesealExectutablePath();
			// TODO: implement good defaults
			//const defaults = collectSealSelectedTextDefaults(context, document);
			//console.log("defaults", defaults)
			let userInput = await collectSealSelectedTextUserInput(context); 
			console.log("userInput", userInput);

			let sealedSecret = 
				await sealSecretFile(
					kubesealPath,
					userInput.certificatePath,
					document.fileName,
					userInput.scope,
					userInput.name,
					userInput.namespace
					);

			const textDocument = await vscode.workspace.openTextDocument({ content: sealedSecret });
			if (textDocument) {
				await vscode.window.showTextDocument(textDocument, { viewColumn: vscode.ViewColumn.Beside });
			}		
		}
	});
	
	context.subscriptions.push(sealKubeSecretFileCommand);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let sealKubeSecretSelectedTextCommand = vscode.commands.registerCommand('extension.sealKubeSecretSelectedText', async () => {
		let editor = vscode.window.activeTextEditor;

		if (editor) {
			let document = editor.document;
			let selection = editor.selection;
			const kubesealPath = getKubesealExectutablePath();
			
			const defaults = collectSealSelectedTextDefaults(context, document);
			console.log("defaults", defaults)
			let userInput = await collectSealSelectedTextUserInput(context, defaults.defaultName, defaults.defaultNamespace, defaults.defaultCertificatePath); 
			console.log("userInput", userInput);
			let plainTextSecret = document.getText(selection);

			let sealedSecret = 
				await sealSecretRaw(
					kubesealPath,
					userInput.certificatePath,
					plainTextSecret,
					userInput.scope,
					userInput.name,
					userInput.namespace
					);

			editor.edit(editBuilder => {
				editBuilder.replace(selection, sealedSecret);
			});
		}
	});

	context.subscriptions.push(sealKubeSecretSelectedTextCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {}

