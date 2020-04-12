import { ExtensionContext, TextDocument } from 'vscode';
import * as yaml from 'js-yaml';
import { SealSecretParameters, Scope } from './types';
import * as path from 'path';

export function collectSealSecretDefaults(context : ExtensionContext, document : TextDocument, lastUsed : SealSecretParameters | null = null) : SealSecretParameters {
    
    // Create result structure 
    let result = lastUsed || {
        certificatePath: undefined,
        name: undefined,
        namespace: undefined,
        scope: undefined
    };
    
    // Special case for for libsonnet files. TODO: should be generalized
    if (!document.isUntitled && path.basename(document.fileName) === 'params.libsonnet')
    {
        // Default scope is assumed to be strict in this case
        result.scope = Scope.strict;

        // Try to extract parameters from path
        const pathParts = path.dirname(document.fileName).split(path.sep);
        const pathPartsRev = pathParts.slice().reverse();

        // Validate
        if (pathPartsRev.length >= 4 && pathPartsRev[3] === 'apps')
        {
            const envName = pathPartsRev[0];
            const appName = pathPartsRev[1];
            const teamName = pathPartsRev[2];
            const root = pathParts.slice().splice(0, pathParts.length - 4).join(path.sep);
            
            result.name = appName;
            result.namespace = `${teamName}-${appName}`;
            result.certificatePath = path.join(root, 'sealed-secrets', envName === 'prod' ? 'prod.pem' : 'nonprod.pem');
        }
    }
    else
    {
        // Try to extract name, namespace and scope from document
        try {
            const documentText = document.getText();
            const documentDom = yaml.safeLoad(documentText);
            result.name = documentDom?.metadata?.name;
            result.namespace = documentDom?.metadata?.namespace;
            const annotations = documentDom?.metadata?.annotations;
            if (annotations && annotations['sealedsecrets.bitnami.com/cluster-wide'] === 'true') 
                {result.scope = Scope.clusterWide;}
            else if (annotations && annotations['sealedsecrets.bitnami.com/namespace-wide'] === 'true')
                {result.scope = Scope.namespaceWide;}
            else if (documentDom?.metadata)
                {result.scope = Scope.strict;}
            } 
        catch(error) {
        }
    }
    
    // Return
    return result;
}
