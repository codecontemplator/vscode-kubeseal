import { ExtensionContext, TextDocument } from 'vscode';
import * as yaml from 'js-yaml'
import { SealSecretParameters } from './types';

export function collectSealSecretDefaults(context : ExtensionContext, document : TextDocument, lastUsed : SealSecretParameters | null = null) : SealSecretParameters {
    
    // Create result structure 
    let result = lastUsed || {
        certificatePath: undefined,
        name: undefined,
        namespace: undefined,
        scope: undefined
    }

    // Try to extract name and namespace from document
    const documentText = document.getText()
    const documentDom = yaml.safeLoad(documentText)
    result.name = documentDom?.metadata?.name
    result.namespace = documentDom?.metadata?.namespace

    // Return
    return result
}
