/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

const TLS = require("tls");

class TcpClient {

    /**
     * @param {string} url 
     * @param {string} request 
     * @param {boolean} closeWhenSent 
     * @param {boolean} closeWhenReceived 
     * @param {Buffer} clientPrivateKey 
     * @param {Buffer} clientCertificate 
     * @param {Array<Buffer>} rootCertificates
     * @returns {Promise<object>}
     */
    static async send(url, request, closeWhenSent, closeWhenReceived, clientPrivateKey, clientCertificate, rootCertificates) {
        if(!url.startsWith("tls://")) {
            throw new Error("The protocol is invalid. "+url);
        }
        let index = url.lastIndexOf(":");
        if(index == -1 || index == url.length-1) {
            throw new Error("The port is invalid. "+url);
        }
        let host = url.substring("tls://".length, index);
        let port = Number(url.substring(index+1));
        return new Promise((resolve, reject) => {
            const socket = TLS.connect(port, host, {
                key: clientPrivateKey,
                cert: clientCertificate,
                ca: rootCertificates,
                checkServerIdentity: (hostname, certificate) => { return undefined; }
            }, () => {
                if(!socket.authorized && socket.authorizationError != null) {
                    reject(socket.authorizationError);
                    return;
                }
                socket.write(request, error => {
                    if(error != null) {
                        socket.destroy();
                        reject(error);
                    }
                });
                if(closeWhenSent) {
                    socket.end();
                    resolve(null);
                }
            });
            socket.on("close", () => {
                socket.destroy();
            });
            socket.on("error", error => {
                socket.destroy();
                reject(error);
            });
            socket.on("data", data => {
                if(closeWhenReceived) {
                    socket.end();
                }
                resolve(data);
            });
        });
    }
}
module.exports = TcpClient;