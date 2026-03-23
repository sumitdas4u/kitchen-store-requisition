import { BadRequestException } from '@nestjs/common'
import { RequisitionStatus } from '../common/enums'

type QuantifiedItem = {
  requested_qty: number | string | null
  issued_qty: number | string | null
  received_qty: number | string | null
}

export type RequisitionTransitionAction =
  | 'submit'
  | 'issue'
  | 'confirm'
  | 'finalize'
  | 'reject'
  | 'cancel'
  | 'resolve'

type TransitionMap = Partial<
  Record<RequisitionStatus, readonly RequisitionStatus[]>
>

const REQUISITION_TRANSITIONS: Record<
  RequisitionTransitionAction,
  TransitionMap
> = {
  submit: {
    [RequisitionStatus.Draft]: [RequisitionStatus.Submitted]
  },
  issue: {
    [RequisitionStatus.Submitted]: [
      RequisitionStatus.PartiallyIssued,
      RequisitionStatus.Issued
    ],
    [RequisitionStatus.PartiallyIssued]: [
      RequisitionStatus.PartiallyIssued,
      RequisitionStatus.Issued
    ]
  },
  confirm: {
    [RequisitionStatus.Submitted]: [
      RequisitionStatus.PartiallyIssued,
      RequisitionStatus.Completed
    ],
    [RequisitionStatus.Issued]: [
      RequisitionStatus.PartiallyIssued,
      RequisitionStatus.Completed
    ],
    [RequisitionStatus.PartiallyIssued]: [
      RequisitionStatus.PartiallyIssued,
      RequisitionStatus.Completed
    ]
  },
  finalize: {
    [RequisitionStatus.Issued]: [RequisitionStatus.Completed],
    [RequisitionStatus.PartiallyIssued]: [RequisitionStatus.Completed],
    [RequisitionStatus.Completed]: [RequisitionStatus.Completed]
  },
  reject: {
    [RequisitionStatus.Draft]: [RequisitionStatus.Rejected],
    [RequisitionStatus.Submitted]: [RequisitionStatus.Rejected],
    [RequisitionStatus.Issued]: [RequisitionStatus.Rejected],
    [RequisitionStatus.PartiallyIssued]: [RequisitionStatus.Rejected],
    [RequisitionStatus.Disputed]: [RequisitionStatus.Rejected],
    [RequisitionStatus.Rejected]: [RequisitionStatus.Rejected]
  },
  cancel: {
    [RequisitionStatus.Submitted]: [RequisitionStatus.Rejected],
    [RequisitionStatus.Issued]: [RequisitionStatus.Rejected],
    [RequisitionStatus.PartiallyIssued]: [RequisitionStatus.Rejected],
    [RequisitionStatus.Rejected]: [RequisitionStatus.Rejected]
  },
  resolve: {
    [RequisitionStatus.Submitted]: [RequisitionStatus.Completed],
    [RequisitionStatus.Issued]: [RequisitionStatus.Completed],
    [RequisitionStatus.PartiallyIssued]: [RequisitionStatus.Completed],
    [RequisitionStatus.Disputed]: [RequisitionStatus.Completed],
    [RequisitionStatus.Completed]: [RequisitionStatus.Completed]
  }
}

function getRequestedItems<T extends QuantifiedItem>(items: T[]) {
  return items.filter((item) => Number(item.requested_qty || 0) > 0)
}

export function assertRequisitionTransition(
  currentStatus: RequisitionStatus,
  nextStatus: RequisitionStatus,
  action: RequisitionTransitionAction,
  errorMessage?: string
) {
  const allowedNextStatuses = REQUISITION_TRANSITIONS[action][currentStatus] ?? []
  if (allowedNextStatuses.includes(nextStatus)) {
    return
  }

  throw new BadRequestException(
    errorMessage ??
      `Cannot ${action} requisition from ${currentStatus} to ${nextStatus}`
  )
}

export function assertRequisitionActionAllowed(
  currentStatus: RequisitionStatus,
  action: RequisitionTransitionAction,
  errorMessage?: string
) {
  const allowedNextStatuses = REQUISITION_TRANSITIONS[action][currentStatus] ?? []
  if (allowedNextStatuses.length > 0) {
    return
  }

  throw new BadRequestException(
    errorMessage ?? `Cannot ${action} requisition from ${currentStatus}`
  )
}

export function deriveStatusAfterIssue<T extends QuantifiedItem>(items: T[]) {
  const requestedItems = getRequestedItems(items)
  if (requestedItems.length === 0) {
    return RequisitionStatus.PartiallyIssued
  }

  const allIssued = requestedItems.every(
    (item) => Number(item.issued_qty || 0) >= Number(item.requested_qty || 0)
  )

  return allIssued
    ? RequisitionStatus.Issued
    : RequisitionStatus.PartiallyIssued
}

export function deriveStatusAfterConfirm<T extends QuantifiedItem>(items: T[]) {
  const requestedItems = getRequestedItems(items)
  if (requestedItems.length === 0) {
    return RequisitionStatus.PartiallyIssued
  }

  const allReceived = requestedItems.every(
    (item) => Number(item.received_qty || 0) >= Number(item.requested_qty || 0)
  )

  return allReceived
    ? RequisitionStatus.Completed
    : RequisitionStatus.PartiallyIssued
}

export function deriveIssuedItemStatus(item: QuantifiedItem) {
  const requestedQty = Number(item.requested_qty || 0)
  const issuedQty = Number(item.issued_qty || 0)

  if (issuedQty <= 0) {
    return 'Rejected'
  }

  return issuedQty >= requestedQty ? 'Issued' : 'Partially Issued'
}

export function deriveReceivedItemStatus(item: QuantifiedItem) {
  const requestedQty = Number(item.requested_qty || 0)
  const receivedQty = Number(item.received_qty || 0)

  if (receivedQty <= 0) {
    return 'Rejected'
  }

  return receivedQty >= requestedQty ? 'Issued' : 'Partially Issued'
}
