import { Scope } from './types';
import * as tmp from 'tmp';
import * as fs from 'fs'
import * as cp from 'child_process';

// https://zaiste.net/nodejs-child-process-spawn-exec-fork-async-await/
export async function sealSecretRaw(
        kubesealPath: string, 
        certificatePath: string,
        plainTextSecret: string,    
        scope: Scope,
        name: string | null,
        namespace: string | null
    ) : Promise<string> {

	// Write secret to a temporary file to avoid the problems with stdin piping. TODO: maybe this can be fixed
	const temporaryFile = tmp.fileSync();
	fs.writeFileSync(temporaryFile.name, plainTextSecret);
    
    // Construct command line
    const normalizedTemporaryFilename = temporaryFile.name.replace(/\\/g, '/');
    const normalizedCertificatePath = `file://${certificatePath.replace(/\\/g, '/')}`;
    let command = '';
    switch(scope)
    {
        case Scope.strict:
            command = `${kubesealPath} --raw --from-file="${normalizedTemporaryFilename}" --namespace "${namespace}" --name "${name}" --cert "${normalizedCertificatePath}"`;
            break;
        case Scope.namespaceWide:
            command = `${kubesealPath} --raw --from-file="${normalizedTemporaryFilename}" --namespace "${namespace}" --scope namespace-wide --cert "${normalizedCertificatePath}"`;
            break;
        case Scope.clusterWide:
            // even though documentation states that namespace is not required (which makes sense) it does not work without it when scope cluser-wide is used
            command = `${kubesealPath} --raw --from-file="${normalizedTemporaryFilename}" --namespace "${namespace}" --scope cluster-wide --cert "${normalizedCertificatePath}"`;
            break;
        default:
            throw `Internal error. Unknown scope ${scope}`;
    }

    console.log("command", command);

    // Execute command line
    try {
        const { stdout } = await cp.exec(command);
        let result : string = "";
        if (stdout) {
            for await (const chunk of stdout) {
                result += chunk.toString();
            };		    
        }
        console.log("encrypted result", result);
        return result;
    }
    catch (error) {
        throw `Execution of kubeseal command failed. ${error}`;
    }
    finally {
        temporaryFile.removeCallback();
    }
}

export async function sealSecretFile(
    kubesealPath: string, 
    certificatePath: string,
    secretFilePath: string,
    scope: Scope,
    name: string | null,
    namespace: string | null
    )
{
    // Get file data
    const secretFileData = fs.readFileSync(secretFilePath);
    console.log("secretFileData", secretFileData);

    // Construct command line
    const normalizedCertificatePath = `file://${certificatePath.replace(/\\/g, '/')}`;
    let command = '';
    switch(scope)
    {
        case Scope.strict:
            command = `${kubesealPath} --namespace "${namespace}" --name "${name}" --cert "${normalizedCertificatePath}" --format yaml`;
            break;
        case Scope.namespaceWide:
            command = `${kubesealPath} --namespace "${namespace}" --scope namespace-wide --cert "${normalizedCertificatePath}" --format yaml`;
            break;
        case Scope.clusterWide:
            command = `${kubesealPath} --scope cluster-wide --cert "${normalizedCertificatePath}" --format yaml`;
            break;
        default:
            throw `Internal error. Unknown scope ${scope}`;
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
        console.log("encrypted result", result);
        return result;
    }
    catch (error) {
        throw `Execution of kubeseal command failed. ${error}`;
    }    
}