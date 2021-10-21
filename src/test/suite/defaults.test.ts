import * as assert from 'assert';
import sinon, { stubInterface  } from "ts-sinon";
import { collectSealSecretDefaults } from '../../defaults';
import { ExtensionContext, TextDocument } from 'vscode';
import { SealSecretParameters, Scope } from '../../types';

suite('Defaults', () => {

    test("Should reuse last used values if available", () => {
        // Arrange
        const context = stubInterface<ExtensionContext>();
        const document = stubInterface<TextDocument>();
        const lastUsed : SealSecretParameters = {
            name: "some-name",
            namespace: "some-namespace",
            certificatePath: "some-path",
            scope: Scope.namespaceWide
        };

        // Act
        const result = collectSealSecretDefaults(context, document, lastUsed);

        // Assert
        assert.equal(result.name, lastUsed.name);
        assert.equal(result.namespace, lastUsed.namespace);
        assert.equal(result.scope, lastUsed.scope);
    });

    test("Should extract name and namespace from secret yaml if available", () => {
        // Arrange
        const context = stubInterface<ExtensionContext>();
        const document = stubInterface<TextDocument>();
        document.getText.callsFake(() => `
apiVersion: v1
kind: Secret
metadata:
    name: secretName
    namespace: secretNamespace
type: Opaque
data:
    username: YWRtaW4=
    password: MWYyZDFlMmU2N2Rm        
`);

        // Act
        const result = collectSealSecretDefaults(context, document);

        // Assert
        assert.equal(result.name, 'secretName');
        assert.equal(result.namespace, 'secretNamespace');
    });

    [ { annotation: null, expectedScope: Scope.strict}
    , { annotation: 'sealedsecrets.bitnami.com/namespace-wide: "true"', expectedScope: Scope.namespaceWide}
    , { annotation: 'sealedsecrets.bitnami.com/cluster-wide: "true"', expectedScope: Scope.clusterWide}
    ].forEach(({ annotation, expectedScope }) =>
        test(`Should extract name and namespace and scope '${Scope[expectedScope]}' from sealed secret yaml if available`, () => {

            // Arrange
            const context = stubInterface<ExtensionContext>();
            const document = stubInterface<TextDocument>();
            document.getText.callsFake(() => `
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
    annotations:
        ${annotation}
    creationTimestamp: null
    name: secretName
    namespace: secretNamespace
spec:
    encryptedData:
    password: AQB7+TpF587XXkdh1V4jqSff/ehj4HmJ72l99Z6CcnX256TDM+LErjUo4vwoDaerlRfptDiyfpDmBhyefLgP3QfewJgPsdDQAltAzt6JVP4eIifFC9LRwoQJtxNCfAmy/TduX6OiQxJyL5w/OMXd5nb63DnR/UU8uquLAWd+YTHaUfkg0pC/xnFGoMeYstlK+Lcp9wl0nsVUoQwUB53cQGjx1PzqtqDMYYbKEkZYb74gn9BuOBQ/JIEhri6LkhqzmGpsfzX5Nxo8HWvALK0JPH9Yi+EvADVPwvJS0J55Vo1u2XNTPENSacZuafbU34YKLxc5e/i33aCkEJkdcdcYHx4etVxRLyL8PTmDesD6j9fIHpNAKsG7g4UmA7q+4g==
    username: AQDu75w/X9mE2op1piAPwWV+pXTiag+XVQKKf9H4uxCxHJEp6//A31jB1KcFaMpWhBcPilBZQbPibnYKosnUuaBJTi9edxc7DMwa8h+pdc9D17N0vfHE9HBoRN6ydMuZGo4/oY6weigxkR/jaUXsDMT6JEhazZqUdKUsDqPQ1bkZAB13KLlf9c22MW6XbYz5MnJgW9c06mLgzZg3BASe6gDeM2KrO3AEaTsV81pY6G+r000+O9AmEBpa90hwHz0OlgrLfnAVrweVkRVN7uPETwWi7f3EDNff9ZCVF4um26Qr4oVQ3OsjSNwaTSxhuK8LTK9zV/lFLLmK0GvSOOluluGpSTjAFwprNVJ4Y3etig+T0y47+CFr
    template:
    metadata:
        annotations:
            ${annotation}
        creationTimestamp: null
        name: secretName
        namespace: secretNamespace
    type: Opaque
status: {}
`);
    
            // Act
            const result = collectSealSecretDefaults(context, document);
    
            // Assert
            assert.equal(result.name, 'secretName');
            assert.equal(result.namespace, 'secretNamespace');
            assert.equal(result.scope, expectedScope);
        })
    );

    test("Should extract defaults from path for params.libsonnet documents", () => {
        // Arrange
        const context = stubInterface<ExtensionContext>();
        const document = <TextDocument>{
            fileName: 'X:\\Develop\\kube-applications-state\\apps\\solutions\\reportgenerator\\uat\\params.libsonnet',
            isUntitled: false
        };
        
        // Act
        const result = collectSealSecretDefaults(context, document);

        // Assert
        assert.equal(result.name, 'reportgenerator');
        assert.equal(result.namespace, 'solutions-reportgenerator');
        assert.equal(result.scope, Scope.strict);
    });

    test("Should fail gracefully for invalid yaml", () => {
        // Arrange
        const context = stubInterface<ExtensionContext>();
        const document = stubInterface<TextDocument>();
        document.getText.callsFake(() => `
apiVersion: v1
kind: Secret
metadata:
    name: secretName
    namespace: secretNamespace
type: Opaque
data:
    username
    password: MWYyZDFlMmU2N2Rm        
`);

        // Act
        const result = collectSealSecretDefaults(context, document);

        // Assert
        assert.equal(result.name, undefined);
        assert.equal(result.namespace, undefined);
    });

    test("Should fail gracefully for params.libsonnet documents with non standard path", () => {
        // Arrange
        const context = stubInterface<ExtensionContext>();
        const document = <TextDocument>{
            fileName: 'X:\\Source\\params.libsonnet',
            isUntitled: false
        };
        
        // Act
        const result = collectSealSecretDefaults(context, document);

        // Assert
        assert.equal(result.name, undefined);
        assert.equal(result.namespace, undefined);
        assert.equal(result.scope, Scope.strict);
    });

});