export type UnreadRole = 'product_specialist' | 'product_manager';
export type UnreadScope = 'workbench' | 'manager-pool' | 'decisions' | 'purchase-pool';

type ProductLike = {
  id: string;
  status: string;
  updatedAt?: string | null;
  screeningSubmittedAt?: string | null;
  managerReviewedAt?: string | null;
  sampleReviewedAt?: string | null;
  anomalyReportedAt?: string | null;
  anomalyHandledAt?: string | null;
  completedAt?: string | null;
  enteredEndedAt?: string | null;
};

export type ProductUnreadEvent = {
  kind: string;
  productId: string;
  timestamp: string;
  role: UnreadRole;
  scope: UnreadScope;
};

function pickTime(...values: Array<string | null | undefined>) {
  return values.find(Boolean) || null;
}

function event(
  product: ProductLike,
  role: UnreadRole,
  scope: UnreadScope,
  kind: string,
  timestamp: string | null,
): ProductUnreadEvent | null {
  if (!timestamp) return null;
  return { kind, productId: product.id, timestamp, role, scope };
}

export function getProductUnreadEvents(product: ProductLike, role: UnreadRole, scopes?: UnreadScope[]) {
  const events: Array<ProductUnreadEvent | null> = [];

  if (role === 'product_manager') {
    if (['screening_submitted', 'manager_reviewing'].includes(product.status)) {
      events.push(event(product, role, 'manager-pool', 'screening_submitted', product.screeningSubmittedAt || product.updatedAt || null));
    }
    if (['sampling_review_submitted', 'sample_reviewed'].includes(product.status)) {
      events.push(event(product, role, 'decisions', 'sampling_review_submitted', product.sampleReviewedAt || product.updatedAt || null));
    }
    if (product.status === 'inspection_anomaly') {
      events.push(event(product, role, 'purchase-pool', 'purchase_anomaly_reported', product.anomalyReportedAt || product.updatedAt || null));
    }
    if (product.status === 'completed') {
      events.push(event(product, role, 'purchase-pool', 'purchase_completed', pickTime(product.completedAt, product.enteredEndedAt, product.updatedAt)));
    }
  }

  if (role === 'product_specialist') {
    if (['pending_sampling', 'returned', 'rejected_unconfirmed'].includes(product.status)) {
      events.push(event(product, role, 'workbench', 'screening_reviewed', product.managerReviewedAt || product.updatedAt || null));
    }
    if (product.status === 'pending_purchase') {
      events.push(event(product, role, 'purchase-pool', 'sampling_reviewed', product.managerReviewedAt || product.updatedAt || null));
    }
    if (['supplier_change_requested', 'rejected_unconfirmed'].includes(product.status)) {
      events.push(event(product, role, 'workbench', 'sampling_reviewed', product.managerReviewedAt || product.updatedAt || null));
    }
    if (product.status === 'anomaly_handling') {
      events.push(event(product, role, 'purchase-pool', 'purchase_anomaly_handled', product.anomalyHandledAt || product.updatedAt || null));
    }
  }

  return events
    .filter((item): item is ProductUnreadEvent => !!item)
    .filter(item => !scopes || scopes.includes(item.scope));
}

function storageKey(userId: string, event: ProductUnreadEvent) {
  return `unread_seen_v2_${userId}_${event.role}_${event.scope}_${event.productId}_${event.kind}`;
}

function notifyUnreadChanged() {
  window.dispatchEvent(new Event('product-unread-change'));
}

export function isUnreadEvent(event: ProductUnreadEvent, userId: string) {
  const seenAt = localStorage.getItem(storageKey(userId, event));
  if (!seenAt) return true;
  return new Date(event.timestamp).getTime() > new Date(seenAt).getTime();
}

export function isProductUnread(product: ProductLike, role: UnreadRole, userId: string, scopes?: UnreadScope[]) {
  return getProductUnreadEvents(product, role, scopes).some(event => isUnreadEvent(event, userId));
}

export function countUnreadProducts(products: ProductLike[], role: UnreadRole, userId: string, scopes?: UnreadScope[]) {
  return products.filter(product => isProductUnread(product, role, userId, scopes)).length;
}

export function markProductUnreadRead(product: ProductLike, role: UnreadRole, userId: string, scopes?: UnreadScope[]) {
  for (const event of getProductUnreadEvents(product, role, scopes)) {
    localStorage.setItem(storageKey(userId, event), event.timestamp);
  }
  notifyUnreadChanged();
}

export function markProductsUnreadRead(products: ProductLike[], role: UnreadRole, userId: string, scopes?: UnreadScope[]) {
  products.forEach(product => markProductUnreadRead(product, role, userId, scopes));
  notifyUnreadChanged();
}
