/*!
 * Copyright 2024 Takuro Okada.
 * Released under the MIT License.
 */

export interface Block {
    version: string;
    index: bigint;
    timestamp: number;
    nonce: number;
    prevHash: string;
    hash: string;
    transactions: Array<Transaction>;
}

export interface Transaction {
    transactionId: string;
    elements?: Array<Transaction>;
}

export interface TransactionCondition {
    operation?: Operation;
    ambiguous?: boolean;
    conditions: object;
}

export type Operation = "and"|"or"|"between";