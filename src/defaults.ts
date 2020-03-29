import { ExtensionContext, TextDocument } from 'vscode';
import * as path from 'path';

export interface CollectSealSelectedTextDefaultsResult {
    defaultCertificatePath: string | null;
    defaultName: string | null;
    defaultNamespace: string | null;
}

// TODO: make generic

// Idea:
/*
defaults: {
    name: {
        filenameSelector: {
            regex: "^(?<root>.+?[\\\/]kube-applications-state)[\\\/]apps[\\\/](?<team>.+?)[\\\/](?<appName>.+?)[\\\/]"
        },
        documentSelector: {
            yamlPath: {
                namespace: "hash.child_attr.key"
            } 
        },
        value: "${appName}"
    },
    namespace: {
        regex: "^(?<root>.+?[\\\/]kube-applications-state)[\\\/]apps[\\\/](?<team>.+?)[\\\/](?<appName>.+?)[\\\/]",
        value: "${team}-${appName}"
    },
    certificatePath: [
        {
            filenameSelector: {
                regex: "^(?<root>.+?[\\\/]kube-applications-state)[\\\/]apps[\\\/](?<team>.+?)[\\\/](?<appName>.+?)[\\\/]prod[\\\/]"
            },
            value: "${root}/sealed-secrets/prod.pem"
        },
        {
            filenameSelector: {
                regex: "^(?<root>.+?[\\\/]kube-applications-state)"
            },
            value: "${root}/sealed-secrets/nonprod.pem"
        },
    ]
}

documentSelector - low prio for now

semantics: if the selectors are not successful not value is generated
if multiple defaults are provides the first one that provides a value will be used


*/
export function collectSealSelectedTextDefaults(context : ExtensionContext, document : TextDocument) : CollectSealSelectedTextDefaultsResult {

    let docFilename = path.normalize(document.fileName).replace(/\\/, '/')
    //docFilename = "C:\\Develop\\kube-applications-state\\apps\\solutions\\kyc\\test\\params.libsonnet";	
    console.log("normalized doc filename", docFilename)
    const parts = docFilename.split(/[\\\/]/)
    parts.reverse()

    const environment = parts[1];
    const rootPath = /.+?kube-applications-state/.exec(docFilename)
    let certPath : string | null = null;
    if (rootPath) {
        certPath = path.join(rootPath?.toString(), "sealed-secrets", environment == 'prod' ? 'prod.pem' : 'nonprod.pem')
    }
    
    const appName = parts[2]
    const teamName = parts[3]

    return {
        defaultCertificatePath: certPath,
        defaultName: appName,
        defaultNamespace: `${teamName}-${appName}`
    };
}