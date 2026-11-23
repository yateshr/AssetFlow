export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'completed';
/** An employee's request for equipment (not the same as a site admin's request to create assets without an invoice). */
export type EquipmentRequest = { id: string; userId: string; assetType: string; reason: string; date: string; status: RequestStatus };
export type StockItem = { id: string; name: string; sku: string; category: string; quantity: number; minQuantity: number; unitCost: number; location: string };
export type MovementType = 'received' | 'issued' | 'returned' | 'adjusted';
export type StockMovement = { id: string; stockId: string; itemName: string; type: MovementType; quantity: number; before: number; after: number; reason: string; performedBy: string; timestamp: string };
export type InfraStatus = 'online' | 'offline' | 'maintenance';
export type Infrastructure = { id: string; name: string; type: string; ipAddress: string; macAddress: string; hostname: string; location: string; status: InfraStatus; vendor: string; model: string; notes: string };

/** A short unique id: two people adding records in the same second never collide. */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
