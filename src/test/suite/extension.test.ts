import * as assert from 'assert';

// https://code.visualstudio.com/api/working-with-extensions/testing-extension
// https://github.com/microsoft/vscode-java-dependency/tree/master/test
// https://github.com/OmniSharp/omnisharp-vscode/blob/master/test/
// https://github.com/microsoft/vscode-azure-blockchain-ethereum/blob/master/test/commands/ProjectCommand.test.ts
// https://github.com/microsoft/vscode-extension-samples/blob/master/quickinput-sample/src/quickOpen.ts
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';
//import * as sinon from 'sinon';
import sinon, { stubInterface  } from "ts-sinon";
import Sinon = require('sinon');

import * as mocha from "mocha";
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as path from 'path'

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	let createQuickPickStub : Sinon.SinonStub; 
	let createInputBoxStub : Sinon.SinonStub;  
	let fileExistsSyncStub : Sinon.SinonStub;  
	
	mocha.beforeEach(() => {
		createQuickPickStub = sinon.stub(vscode.window, 'createQuickPick')
		createInputBoxStub = sinon.stub(vscode.window, 'createInputBox')
		fileExistsSyncStub = sinon.stub(fs, 'existsSync')
	});
	  	
	mocha.afterEach(() => {
		createQuickPickStub.restore();
		createInputBoxStub.restore();
		fileExistsSyncStub.restore();
		//sinon.restore();
	});
	  	
	test('Sample test', () => {
		assert.equal(-1, [1, 2, 3].indexOf(5));
		assert.equal(-1, [1, 2, 3].indexOf(0));
	});

    test("Extension should be present", () => {
        assert.ok(vscode.extensions.getExtension('codecontemplator.kubeseal'));
	});	
	
    test("Extension should activate", async () => {
		const extension = await vscode.extensions.getExtension('codecontemplator.kubeseal')
		await extension?.activate()
	});
		
	test('Convert secret file to sealed secret file', async () => {

		console.log("================= hej ==============")
		const extension = await vscode.extensions.getExtension('codecontemplator.kubeseal')
		if (extension) {
			console.log("activating...", extension.isActive)
			extension.activate();
		} else {
			console.log("not found")
		}
		
		fileExistsSyncStub.callsFake(() => true);
		
		//const createQuickPickStub = sinon.stub(vscode.window, 'createQuickPick');
        createQuickPickStub.callsFake(() => {
			var quickPickStub = stubInterface<vscode.QuickPick<any>>();
			quickPickStub.onDidChangeSelection.callsFake(handler => {
				switch(quickPickStub.placeholder)
				{
					case 'Select scope':
						const selectedItem = quickPickStub.items[0] //.find(x => true); //TODO
						return handler([selectedItem]);
					default:
						throw 'Unhandled quick pick';
				}
			});
			return quickPickStub;
		});

		createInputBoxStub.callsFake(() => {
			var inputBoxStub = stubInterface<vscode.InputBox>();
			inputBoxStub.onDidAccept.callsFake(asyncHandler => {
				switch(inputBoxStub.prompt)
				{
					case 'Specify name':
						inputBoxStub.value = 'fake-name';
						break;
					case 'Specify namespace':
						inputBoxStub.value = 'fake-namespace';
						break;
					case 'Specify certificate path':
						const x = path.resolve(__dirname, '../../../example/cert.pem')
						console.log("path=",x)
						inputBoxStub.value = x; //'fake-cert.pem';
						break;
					default:
						throw 'Unhandled input box';
				}

				return asyncHandler();
			});
			return inputBoxStub;
		});
				
		const secretFileContent = `
apiVersion: v1
kind: Secret
metadata:
  name: exampleSecret
#  namespace: exampleNamespace
type: Opaque
data:
  username: YWRtaW4=
  password: MWYyZDFlMmU2N2Rm
`;

		function delay(ms: number) {
			return new Promise( resolve => setTimeout(resolve, ms) );
		}

		const temporaryFile = tmp.fileSync();
		try
		{
			console.log("temp file ", temporaryFile.name)
			fs.writeFileSync(temporaryFile.name, secretFileContent);
	
			const origdoccount=  vscode.workspace.textDocuments.length;
			console.log("len=",vscode.workspace.textDocuments.length);
			const textDocument = await vscode.workspace.openTextDocument(temporaryFile.name) //({ content: secretFileContent })
			await vscode.window.showTextDocument(textDocument);
			console.log("len=",vscode.workspace.textDocuments.length);
			

			assert.notEqual(textDocument, null);
			//assert.equal(vscode.workspace.textDocuments.length, origdoccount + 1);
			await vscode.commands.executeCommand('extension.sealKubeSecretFile');
			//assert.equal(vscode.workspace.textDocuments.length, 2);

		}
		finally
		{
			temporaryFile.removeCallback();
		}
	});
});
