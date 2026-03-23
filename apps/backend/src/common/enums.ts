export enum Role {
  Kitchen = 'Kitchen User',
  Store = 'Store User',
  Admin = 'Admin'
}

export enum RequisitionStatus {
  Draft = 'Draft',
  Submitted = 'Submitted',
  PartiallyIssued = 'Partially Issued',
  Issued = 'Issued',
  Disputed = 'Disputed',
  Completed = 'Completed',
  Rejected = 'Rejected'
}

export enum Shift {
  Morning = 'Morning',
  Evening = 'Evening'
}

export enum StockEntrySyncStatus {
  NotStarted = 'not_started',
  DraftPending = 'draft_pending',
  DraftCreated = 'draft_created',
  SubmitPending = 'submit_pending',
  Submitted = 'submitted',
  Failed = 'failed'
}
