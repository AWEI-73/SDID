/**
 * GEMS: CoreTypes | P0 | ✓✓ | N/A→void | Story-0.0 | 核心型別定義
 * GEMS-FLOW: DEFINE→FREEZE→EXPORT
 * GEMS-DEPS: 無
 * GEMS-DEPS-RISK: LOW
 */
// AC-0.0
// [STEP] DEFINE
// [STEP] FREEZE
// [STEP] EXPORT

// @GEMS-ENUM: TransactionType
export type TransactionType = 'INCOME' | 'EXPENSE';

// @GEMS-CONTRACT: Transaction
// @GEMS-TABLE: tbl_transactions
export interface Transaction {
  id: string;            // UUID, PK
  type: TransactionType; // ENUM('INCOME','EXPENSE'), NOT NULL
  amount: number;        // DECIMAL(10,2), NOT NULL, > 0
  categoryId: string;    // VARCHAR(36), FK → tbl_categories.id, NOT NULL
  note: string;          // VARCHAR(200)
  date: string;          // VARCHAR(10), YYYY-MM-DD, NOT NULL
  createdAt: Date;       // TIMESTAMP, NOT NULL
}

// @GEMS-CONTRACT: Category
// @GEMS-TABLE: tbl_categories
export interface Category {
  id: string;            // UUID, PK
  name: string;          // VARCHAR(50), NOT NULL
  type: TransactionType; // ENUM('INCOME','EXPENSE'), NOT NULL
  icon: string;          // VARCHAR(10)
}

// @GEMS-CONTRACT: MonthlySummary
export interface MonthlySummary {
  month: string;              // VARCHAR(7), YYYY-MM, NOT NULL
  income: number;             // DECIMAL(10,2), NOT NULL, >= 0
  expense: number;            // DECIMAL(10,2), NOT NULL, >= 0
  net: number;                // COMPUTED: income - expense
  byCategory: CategorySummary[]; // NOT NULL
}

// @GEMS-CONTRACT: CategorySummary
export interface CategorySummary {
  categoryId: string;   // FK → tbl_categories.id
  categoryName: string; // VARCHAR(50)
  total: number;        // DECIMAL(10,2), >= 0
  percentage: number;   // 0-100
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  categoryId: string;
  note?: string;
  date: string;
}
