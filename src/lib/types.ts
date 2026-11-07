export type LoanStatus = "draft" | "offer" | "active";
export interface Loan {
  id: string;
  user_id: string;
  lender: string;
  status: LoanStatus;
  principal_centavos: number | null;
  proceeds_centavos: number | null;
  withheld_centavos: number | null;
  upfront_paid_centavos: number | null;
  disbursement_date: string | null;
  first_due_date: string | null;
  term_months: number | null;
  frequency: string;
  notes: string;
  created_at: string;
}
export interface Terms {
  loan_id: string;
  interest_wording: string;
  rate: string | null;
  rate_period: string;
  calculation_method: string;
  penalty_wording: string;
  prepayment_terms: string;
  collateral: string;
  guaranty: string;
  suretyship: string;
  security_notes: string;
  schedule_complete: boolean;
}
export interface Installment {
  id: string;
  loan_id: string;
  due_date: string;
  amount_centavos: number;
  sequence: number;
}
export interface Allocation {
  installment_id: string;
  amount_centavos: number;
}
export interface Payment {
  id: string;
  loan_id: string;
  paid_on: string;
  amount_centavos: number;
  reference: string;
  notes: string;
  principal_centavos: number | null;
  interest_centavos: number | null;
  fees_centavos: number | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  payment_allocations: Allocation[];
}
export interface DocumentRecord {
  id: string;
  loan_id: string;
  payment_id: string | null;
  filename: string;
  object_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}
export interface Correction {
  id: string;
  loan_id: string;
  action: string;
  reason: string;
  created_at: string;
  before_data: unknown;
  after_data: unknown;
}
export interface LoanRecord extends Loan {
  loan_terms: Terms | null;
  installments: Installment[];
  payments: Payment[];
  documents: DocumentRecord[];
  correction_history: Correction[];
}
