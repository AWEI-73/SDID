import type {
  Transaction,
  MonthlySummary,
  CreateTransactionInput,
} from './core-types';

/**
 * GEMS: IServiceContracts | P1 | ✓✓ | N/A→void | Story-0.0 | API 介面契約
 * GEMS-FLOW: DEFINE→VALIDATE→EXPORT
 * GEMS-DEPS: [CoreTypes]
 * GEMS-DEPS-RISK: MEDIUM
 */
// AC-0.0
// AC-0.1
// [STEP] DEFINE
// [STEP] VALIDATE
// [STEP] EXPORT

// @GEMS-API: ILedgerService
export interface ILedgerService {
  createTransaction(data: CreateTransactionInput): Promise<Transaction>;
  getTransactions(month: string): Promise<Transaction[]>;
  deleteTransaction(id: string): Promise<void>;
}

// @GEMS-API: ISummaryService
export interface ISummaryService {
  getMonthlySummary(month: string): Promise<MonthlySummary>;
}
