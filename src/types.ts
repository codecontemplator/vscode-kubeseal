export enum Scope {
    strict = 1,
    namespaceWide = 2,
    clusterWide = 3
}

export interface SealSecretParameters {
    certificatePath: string | undefined;
    name: string | undefined;
    namespace: string | undefined;
    scope: Scope | undefined;
}

export interface ExtensionState {
    kubeSealPath: string | undefined,
    sealSecretParams: SealSecretParameters | undefined,
    localCert: boolean | true
}