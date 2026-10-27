import { PublicReservationService } from './service.js';

export class PublicController {
  constructor(private readonly service: PublicReservationService) {}

  async create(): Promise<void> {
    await this.service.reserve();
  }
}
