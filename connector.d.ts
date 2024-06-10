/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

import { Transaction } from "./transaction";

export interface MetamereConnector {
    /**
     * Add transactions
     * @param transactions Data to be registered in the blockchain
     * @param temporary Hold transaction pending until finalized
     */
    addTransactions(transactions: Array<Transaction>, temporary?: boolean): Promise<Array<string>|null>;

    /**
     * Finalize transactions
     * @param transactionIds Identifier of the transaction data
     */
    commitTransactions(transactionIds: Array<string>): Promise;

    /**
     * Retrieve transactions
     * @param condition Search condition
     * @param offset Offset of search index
     * @param limit Maximum number of search
     * @param timestampStart Start searching for timestamps
     * @param timestampEnd End searching for timestamps
     * @param timestampRequired Timestamping of search result transactions
     * @returns {Promise<Array<Transaction>|null>} Search results
     */
    getTransactions(condition: TransactionCondition, offset?: number, limit?: number, timestampStart?: number, timestampEnd?: number, timestampRequired?: boolean): Promise<Array<Transaction>|null>;
}