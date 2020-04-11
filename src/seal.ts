import { Scope, SealSecretParameters } from './types';
import * as tmp from 'tmp';
import * as fs from 'fs'
import * as cp from 'child_process';

// https://zaiste.net/nodejs-child-process-spawn-exec-fork-async-await/
export async function sealSecretRaw(
        kubesealPath: string, 
        plainTextSecret: string,   
        sealSecretParams : SealSecretParameters
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
            command = `${kubesealPath} --raw --from-file="${normalizedTemporaryFilename}" --namespace "${sealSecretParams.namespace}" --name "${sealSecretParams.name}" --cert "${normalizedCertificatePath}"`;
            break;
        case Scope.namespaceWide:
            command = `${kubesealPath} --raw --from-file="${normalizedTemporaryFilename}" --namespace "${sealSecretParams.namespace}" --scope namespace-wide --cert "${normalizedCertificatePath}"`;
            break;
        case Scope.clusterWide:
            // even though documentation states that namespace is not required (which makes sense) it does not work without it when scope cluser-wide is used
            // this is a confirmed bug; https://github.com/bitnami-labs/sealed-secrets/issues/393
            command = `${kubesealPath} --raw --from-file="${normalizedTemporaryFilename}" --namespace dummyNamespace --scope cluster-wide --cert "${normalizedCertificatePath}"`;
            break;
        default:
            throw `Internal error. Unknown scope ${sealSecretParams.scope}`;
    }

    // Execute command line
    try {
        const { stdout } = await cp.exec(command);
        let result : string = "";
        if (stdout) {
            for await (const chunk of stdout) {
                result += chunk.toString();
            };		    
        }
        return result;
    }
    catch (error) {
        // TODO: this error handling does not work. no exception is thrown when things fails
        throw `Execution of kubeseal command failed. ${error}`;
    }
    finally {
        temporaryFile.removeCallback();
    }
}

export async function sealSecretFile(
    kubesealPath: string, 
    secretFilePath: string,
    sealSecretParams : SealSecretParameters
    )
{
    // Get file data
    const secretFileData = fs.readFileSync(secretFilePath);

    // Construct command line
    const normalizedCertificatePath = `file://${sealSecretParams.certificatePath?.replace(/\\/g, '/')}`;
    let command = '';
    switch(sealSecretParams.scope)
    {
        case Scope.strict:
            command = `${kubesealPath} --namespace "${sealSecretParams.namespace}" --name "${sealSecretParams.name}" --cert "${normalizedCertificatePath}" --format yaml`;
            break;
        case Scope.namespaceWide:
            command = `${kubesealPath} --namespace "${sealSecretParams.namespace}" --scope namespace-wide --cert "${normalizedCertificatePath}" --format yaml`;
            break;
        case Scope.clusterWide:
            command = `${kubesealPath} --scope cluster-wide --cert "${normalizedCertificatePath}" --format yaml`;
            break;
        default:
            throw `Internal error. Unknown scope ${sealSecretParams.scope}`;
    }
    
    // Execute command line
    try {
        const cmdProcess = cp.exec(command);
        cmdProcess.stdin?.end(secretFileData);
        const { stdout } = await cmdProcess;

        let result : string = "";
        if (stdout) {
            for await (const chunk of stdout) {
                result += chunk.toString();
            };		    
        }

        return result;
    }
    catch (error) {
        // TODO: this error handling does not work. no exception is thrown when things fails
        throw `Execution of kubeseal command failed. ${error}`;
    }    
}