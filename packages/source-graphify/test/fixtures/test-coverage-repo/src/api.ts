import { InventoryService } from './inventory.js';

export class InventoryApi {
  constructor(private readonly inventory: InventoryService) {}

  async placeHold(itemId: string): Promise<void> {
    await this.inventory.reserve(itemId);
  }
}
