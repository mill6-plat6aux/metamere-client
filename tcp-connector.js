/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

const Axon = require("axon");

class TcpClient {

    /**
     * @param {string} url 
     * @param {string} request 
     * @param {boolean} closeWhenSent 
     * @param {boolean} closeWhenReceived 
     * @returns {Promise<object>}
     */
    static async send(url, request, closeWhenSent, closeWhenReceived) {
        return new Promise((resolve, reject) => {
            let socket = /** @type {Axon.PubSocket} */(Axon.socket("push"));
            socket.connect(url);
            socket.on("connect", () => {
                socket.send(request);
                if(closeWhenSent) {
                    socket.close();
                    resolve(null);
                }
            });

            socket.on("socket error", error => {
                socket.close();
                reject(error);
            });
    
            socket.on("error", error => {
                socket.close();
                reject(error);
            });
    
            socket.on("message", data => {
                if(closeWhenReceived) {
                    socket.close();
                }
                resolve(data);
            });
        });
    }
}
module.exports = TcpClient;