/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

// @ts-check

const EventEmitter = require("events");
const { readFileSync } = require("fs");
const WebSocketClient = require("./websocket-connector");
const TcpClient = require("./tcp-connector");
const TlsClient = require("./tls-connector");

/**
 * @typedef { import("./transaction").Block } Block
 * @typedef { import("./transaction").Transaction } Transaction
 * @typedef { import("./transaction").TransactionCondition } TransactionCondition
 * @typedef { import("./connector").MetamereConnector } MetamereConnector
 */

/**
 * @typedef {object} NodeSetting
 * @property {string} url
 */

/**
 * @typedef {object} Setting
 * @property {string} blockVersion
 * @property {boolean} [observe]
 * @property {string} [protocol]
 * @property {Array<NodeSetting>} nodes
 * @property {string} [privateKey]
 * @property {string} [certificate]
 * @property {Array<string>} [rootCertificates]
 */

/**
 * @typedef {object} Certificates
 * @property {Buffer} privateKey
 * @property {Buffer} certificate
 * @property {Array<Buffer>} rootCertificates
 */

/**
 * @implements {MetamereConnector}
 */
class Connector extends EventEmitter {

    /** @type {Setting} */
    #settings;

    /** @type {Certificates} */
    #certificates

    /**
     * @param {Setting} settings 
     */
    constructor(settings) {
        super();
        if(settings.nodes == null || settings.nodes.length == 0) {
            throw new Error("The nodes is not included in the blockchain configuration.");
        }
        this.#settings = settings;

        if(this.#settings.protocol == "tls") {
            let clientPrivateKeyFilePath = this.#settings.privateKey;
            let clientCertificateFilePath = this.#settings.certificate;
            let rootCertificateFilePaths = this.#settings.rootCertificates;
            if(clientPrivateKeyFilePath == null) {
                throw new Error("privateKey is not set.");
            }
            if(clientCertificateFilePath == null) {
                throw new Error("certificate is not set.");
            }
            if(rootCertificateFilePaths == null || !Array.isArray(rootCertificateFilePaths) || rootCertificateFilePaths.length == 0) {
                throw new Error("serverCertificates is not set.");
            }
            let clientPrivateKey = readFileSync(clientPrivateKeyFilePath);
            let clientCertificate = readFileSync(clientCertificateFilePath);
            let rootCertificates = rootCertificateFilePaths.map(rootCertificateFilePath => readFileSync(rootCertificateFilePath));
            if(clientPrivateKey == null) {
                throw new Error(clientPrivateKeyFilePath+" not found.");
            }
            if(clientCertificate== null) {
                throw new Error(clientCertificateFilePath+" not found.");
            }
            if(rootCertificates.findIndex(rootCertificate => rootCertificate == null) != -1) {
                throw new Error(rootCertificates+" not found.");
            }
            this.#certificates = {
                privateKey: clientPrivateKey,
                certificate: clientCertificate,
                rootCertificates: rootCertificates
            };
        }

        this.#addObserverToBlockchain();
    }

    /**
     * Receive blockchain update notifications
     */
    #addObserverToBlockchain() {
        let self = this;
        this.#sendCommand("addObserver", null, false, true).then(data => {
            if(data == null) return;

            // Notification of updated block header information
            this.emit("create", data);
        }).catch(error => {
            this.emit("error", new Error("Registration of blockchain observer failed. (" + error.message + "\n" + error.stack + ")"));
            setTimeout(() => {
                self.#addObserverToBlockchain();
            }, 5000);
        });
    }

    async addTransactions(transactions, temporary) {
        if(transactions == null) return Promise.resolve(null);
        if(!Array.isArray(transactions)) return Promise.reject(new Error("The transactions argument is not Array."));
        return new Promise((resolve, reject) => {
            if(temporary == undefined || !temporary) {
                let timeout = setTimeout(() => {
                    reject(new Error("Adding transactions is timeout."));
                    this.off("create", blockObserver);
                }, 5000);
                let blockObserver = block => {
                    if(block == null) {
                        this.emit("error", new Error("The block is empty."));
                        return;
                    }
                    if(block.transactions == null) {
                        this.emit("error", new Error("Transactions in the block["+block.index+"] is empty."));
                        return;
                    }
                    for(let i=0; i<transactions.length; i++) {
                        let transaction = transactions[i];
                        let index = block.transactions.findIndex(_transaction => {
                            return _transaction.transactionId == transaction.transactionId;
                        });
                        if(index == -1) {
                            return;
                        }
                    }
                    clearTimeout(timeout);
                    this.off("create", blockObserver);
                    resolve(transactions.map(entry => entry.transactionId));
                };
                this.on("create", blockObserver);
            }
            let command = temporary == undefined || !temporary ? "addTransaction" : "addTemporaryTransaction";
            this.#sendCommand(command, transactions, true, false).then(() => {
                if(temporary != undefined && temporary) {
                    resolve(transactions.map(entry => entry.transactionId));
                }
            }).catch(reject);
        });
    }

    /**
     * Finalize transactions
     * @param {Array<string>} transactionIds 
     * @returns {Promise}
     */
    async commitTransactions(transactionIds) {
        if(transactionIds == null) return Promise.reject();
        if(!Array.isArray(transactionIds)) return Promise.reject();
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                reject(new Error("Adding transactions is timeout."));
                this.off("create", blockObserver);
            }, 5000);
            let blockObserver = block => {
                if(block == null) {
                    this.emit("error", new Error("The block is empty."));
                    return;
                }
                if(block.transactions == null) {
                    this.emit("error", new Error("Transactions in the block["+block.index+"] is empty."));
                    return;
                }
                for(let i=0; i<transactionIds.length; i++) {
                    let transactionId = transactionIds[i];
                    let index = block.transactions.findIndex(_transaction => {
                        return _transaction.transactionId == transactionId;
                    });
                    if(index == -1) {
                        return;
                    }
                }
                clearTimeout(timeout);
                this.off("create", blockObserver);
                resolve(null);
            };
            this.on("create", blockObserver);
            this.#sendCommand("commitTransaction", transactionIds, true, false).catch(reject);
        });
    }

    /**
     * Retrieve the block
     * @param {bigint} index block index
     * @returns {Promise<Block>}
     */
    async getBlock(index) {
        return new Promise((resolve, reject) => {
            this.#sendCommand("getBlock", index, false, false).then(block => {
                resolve(block);
            }).catch(reject);
        });
    }

    /**
     * Retrieve transactions
     * @param {TransactionCondition} condition Search condition
     * @param {number} [offset] Offset of search index
     * @param {number} [limit] Maximum number of search
     * @param {number} [timestampStart] Start searching for timestamps
     * @param {number} [timestampEnd] End searching for timestamps
     * @param {boolean} [timestampRequired] Timestamping of search result transactions
     * @returns {Promise<Array<Transaction>|null>} Search results
     */
    async getTransactions(condition, offset, limit, timestampStart, timestampEnd, timestampRequired) {
        if(condition != null && (typeof(condition) != "object" || condition.conditions == null)) { 
            return Promise.reject(new Error("The condition parameter is invalid.")); 
        }
        let request = {
            direction: "backward",
            headerOnly: false,
            timestampStart: timestampStart,
            timestampEnd: timestampEnd,
            transactionCondition: condition !== undefined ? condition : null
        };
        return new Promise((resolve, reject) => {
            this.#sendCommand("getBlocks", request, false, false).then(blocks => {
                if(blocks == null) {
                    resolve(null);
                    return;
                }
                let transactions;
                if(timestampRequired == undefined || !timestampRequired) {
                    transactions = blocks.flatMap(block => {
                        return block.transactions != null ? block.transactions : [];
                    });
                }else {
                    transactions = blocks.flatMap(block => {
                        let transactions = block.transactions != null ? block.transactions : [];
                        return transactions.map(transaction => {
                            transaction.timestamp = block.timestamp;
                            return transaction;
                        });
                    });
                }
                if(limit != null) {
                    if(offset != null) {
                        transactions.splice(0, offset);
                    }
                    transactions.splice(limit, transactions.length-limit);
                }
                resolve(transactions);
            }).catch(reject);
        });
    }

    /**
     * Sends a command. If transmission fails, retries up to the default number of times.
     * @param {string} commandName 
     * @param {object} data 
     * @param {boolean} [oneway=true] Disconnect immediately after transmission is complete
     * @param {boolean} [resident=false] Keep the connection alive after the results have been received
     * @param {number} [retry]
     * @returns {Promise<object|null>}
     */
    async #sendCommand(commandName, data, oneway, resident, retry) {
        if(commandName == undefined) return;

        let request;
        if(retry == undefined) {
            let _request = {command: commandName};
            if(data != undefined) {
                _request["data"] = data;
            }
            request = JSON.stringify(_request);
        }else {
            request = data;
        }
        
        let node = this.#getNode();

        let response;
        try {
            if(this.#settings.protocol != null) {
                if(this.#settings.protocol == "ws") {
                    response = await WebSocketClient.send(
                        node.url, 
                        request, 
                        oneway == undefined || oneway, 
                        resident == undefined || !resident
                    );
                }else if(this.#settings.protocol == "tls") {
                    response = await TlsClient.send(
                        node.url, 
                        request, 
                        oneway == undefined || oneway, 
                        resident == undefined || !resident,
                        this.#certificates.privateKey,
                        this.#certificates.certificate,
                        this.#certificates.rootCertificates
                    );
                }else {
                    response = await TcpClient.send(
                        node.url, 
                        request, 
                        oneway == undefined || oneway, 
                        resident == undefined || !resident
                    );
                }
            }else {
                response = await TcpClient.send(
                    node.url, 
                    request, 
                    oneway == undefined || oneway, 
                    resident == undefined || !resident
                );
            }
        }catch(error) {
            if(retry == undefined || retry < 3) {
                if(retry == undefined) {
                    retry = 0;
                }
                retry += 1;
                return this.#sendCommand(commandName, request, oneway, resident, retry);
            }
            throw error;
        }

        if(response == null || (response instanceof Buffer && response.length == 0)) {
            return null;
         }
        let string;
        if(response instanceof Buffer) {
            string = response.toString("utf8");
        }else if(typeof response == "string") {
            string = response;
        }
        if(string == null || string.length == 0) {
            return null;
        }
        let message = JSON.parse(string);
        if(message == null) {
            return null;
        }
        if(message.dataName != null && message.data != null) {
            return message.data;
        }
        return null;
    }

    /**
     * @returns {NodeSetting}
     */
    #getNode() {
        let node;
        if(this.#settings.nodes.length == 1) {
            node = this.#settings.nodes[0];
        }else {
            let index = Math.floor(Math.random() * this.#settings.nodes.length);
            node = this.#settings.nodes[index];
        }
        return node;
    }
}
module.exports = Connector;