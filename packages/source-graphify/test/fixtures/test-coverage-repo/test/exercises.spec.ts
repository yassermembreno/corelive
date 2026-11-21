import { describe, expect, it } from 'vitest';
import { InventoryService } from '../src/inventory.js';

describe('InventoryService', () => {
  it('reserves an item', async () => {
    const service = new InventoryService();
    await expect(service.reserve('sku-1')).resolves.toBe(true);
  });

  it('rejects empty item id', async () => {
    const service = new InventoryService();
    await expect(service.reserve('')).rejects.toThrow('itemId required');
  });
});
