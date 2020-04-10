export enum Scope {
    strict,
    namespaceWide,
    clusterWide
}

export interface SealSecretParameters {
    certificatePath: string | undefined;
    name: string | undefined;
    namespace: string | undefined;
    scope: Scope | undefined;
}

export interface ExtensionState {
    kubeSealPath: string | undefined,
    sealSecretParams: SealSecretParameters | undefined
}