import { Scope, SealSecretParameters } from './types';
import * as tmp from 'tmp';
import * as fs from 'fs';
import * as cp from 'child_process';

export async function sealSecretRaw(
        kubesealPath: string, 
        plainTextSecret: string,   
        sealSecretParams : SealSecretParameters,
        localCert: boolean,
    ) : Promise<string> {

	// Write secret to a temporary file to since --from-file=stdin does not work on windows. This is a known problem at the time of writing.
	const temporaryFile = tmp.fileSync();
	fs.writeFileSync(temporaryFile.name, plainTextSecret);
    
    // Construct command line
    const normalizedTemporaryFilename = temporaryFile.name.replace(/\\/g, '/');
    const normalizedCertificatePath = `file://${sealSecretParams.certificatePath?.replace(/\\/g, '/')}`;
    let command = '';
    switch(sealSecretParams.scope)
    {
        case Scope.strict:
            command = `${kubesealPath} --raw --from-file="${normalizedTemporaryFilename}" --namespace "${sealSecretParams.namespace}" --name "${sealSecretParams.name}"`;
            break;
        case Scope.namespaceWide:
            command = `${kubesealPath} --raw --from-file="${normalizedTemporaryFilename}" --namespace "${sealSecretParams.namespace}" --scope namespace-wide`;
            break;
        case Scope.clusterWide:
            // even though documentation states that namespace is not required (which makes sense) it does not work without it when scope cluser-wide is used
            // this is a confirmed bug; https://github.com/bitnami-labs/sealed-secrets/issues/393
            command = `${kubesealPath} --raw --from-file="${normalizedTemporaryFilename}" --namespace dummyNamespace --scope cluster-wide`;
            break;
        default:
            throw new Error(`Internal error. Unknown scope ${sealSecretParams.scope}`);
    }
    if (localCert){
        command = `${command} --cert "${normalizedCertificatePath}"`;
    }

    // Execute command line
    return new Promise<string>((resolve,reject) => {
        cp.exec(command, {}, (error, stdout) => {
            if (error) {
                reject(error.message);
            } else {
                resolve(stdout);
            }
        });
    }).finally(temporaryFile.removeCallback);
}

export async function sealSecretFile(
    kubesealPath: string, 
    secretFilePath: string,
    sealSecretParams : SealSecretParameters,
    localCert: boolean,
    ) : Promise<string>
{
    // Get file data
    const secretFileData = fs.readFileSync(secretFilePath);

    // Construct command line
    const normalizedCertificatePath = `file://${sealSecretParams.certificatePath?.replace(/\\/g, '/')}`;
    let command = '';
    switch(sealSecretParams.scope)
    {
        case Scope.strict:
            command = `${kubesealPath} --namespace "${sealSecretParams.namespace}" --name "${sealSecretParams.name}" --format yaml`;
            break;
        case Scope.namespaceWide:
            command = `${kubesealPath} --namespace "${sealSecretParams.namespace}" --scope namespace-wide --format yaml`;
            break;
        case Scope.clusterWide:
            command = `${kubesealPath} --scope cluster-wide --format yaml`;
            break;
        default:
            throw new Error(`Internal error. Unknown scope ${sealSecretParams.scope}`);
    }
    if (localCert){
        command = `${command} --cert "${normalizedCertificatePath}"`;
    }

    // Execute command line
    return new Promise<string>((resolve,reject) => {
        const cmdProcess = cp.exec(command, {}, (error, stdout) => {
            if (error) {
                reject(error.message);
            } else {
                resolve(stdout);
            }
        });

        cmdProcess.stdin?.end(secretFileData);
    });
}