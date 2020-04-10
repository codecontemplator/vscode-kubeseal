import { ExtensionContext, TextDocument } from 'vscode';
import * as yaml from 'js-yaml'
import { SealSecretParameters, Scope } from './types';

export function collectSealSecretDefaults(context : ExtensionContext, document : TextDocument, lastUsed : SealSecretParameters | null = null) : SealSecretParameters {
    
    // Create result structure 
    let result = lastUsed || {
        certificatePath: undefined,
        name: undefined,
        namespace: undefined,
        scope: undefined
    }

    // Try to extract name, namespace and scope from document
    const documentText = document.getText()
    const documentDom = yaml.safeLoad(documentText)
    result.name = documentDom?.metadata?.name
    result.namespace = documentDom?.metadata?.namespace
    const annotations = documentDom?.metadata?.annotations;
    if (annotations && annotations['sealedsecrets.bitnami.com/cluster-wide'] == 'true') 
        result.scope = Scope.clusterWide
    else if (annotations && annotations['sealedsecrets.bitnami.com/namespace-wide'] == 'true')
        result.scope = Scope.namespaceWide
    else if (documentDom?.metadata)
        result.scope = Scope.strict

    // Return
    return result
}
