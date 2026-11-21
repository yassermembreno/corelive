export class InventoryService {
  async reserve(itemId: string): Promise<boolean> {
    if (!itemId) {
      throw new Error('itemId required');
    }
    return true;
  }
}
