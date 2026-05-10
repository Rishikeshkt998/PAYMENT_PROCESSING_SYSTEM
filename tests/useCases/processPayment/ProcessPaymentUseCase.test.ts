import ProcessPaymentUseCase from '../../../src/useCases/processPayment/ProcessPaymentUseCase';
import { IPaymentRepository } from '../../../src/domain/repositories/IPaymentRepository';
import { IPaymentGateway, PaymentGatewayResponse } from '../../../src/domain/services/IPaymentGateway';
import { PaymentStatus } from '../../../src/domain/PaymentEntity';

// Mock Redis Service
jest.mock('../../../src/infrastructure/cache/RedisService', () => ({
  LockService: {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(true),
  },
}));

import { LockService } from '../../../src/infrastructure/cache/RedisService';

describe('ProcessPaymentUseCase', () => {
  let useCase: ProcessPaymentUseCase;
  let mockRepo: jest.Mocked<IPaymentRepository>;
  let mockGateway: jest.Mocked<IPaymentGateway>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findByExternalId: jest.fn(),
      save: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockGateway = {
      process: jest.fn(),
    };

    useCase = new ProcessPaymentUseCase({
      PaymentRepository: mockRepo,
      GatewaySimulator: mockGateway,
    });
    
    jest.clearAllMocks();
  });

  describe('initiatePayment', () => {
    it('should handle idempotent requests and return existing payment', async () => {
      const existingPayment = { _id: '123', amount: 100, currency: 'USD', status: PaymentStatus.SUCCESS, idempotencyKey: 'key1' };
      mockRepo.findByIdempotencyKey.mockResolvedValue(existingPayment as any);

      const result = await useCase.initiatePayment({ amount: 100, currency: 'USD', idempotencyKey: 'key1' });

      expect(result.isIdempotent).toBe(true);
      expect(result.payment).toEqual(existingPayment);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should create new payment and trigger processing if not idempotent', async () => {
      mockRepo.findByIdempotencyKey.mockResolvedValue(null);
      const newPayment = { _id: '123', amount: 100, currency: 'USD', status: PaymentStatus.PENDING, idempotencyKey: 'key1' };
      mockRepo.save.mockResolvedValue(newPayment as any);
      
      // Mock processPayment to avoid actual execution in this test
      jest.spyOn(useCase, 'processPayment').mockResolvedValue(newPayment as any);

      const result = await useCase.initiatePayment({ amount: 100, currency: 'USD', idempotencyKey: 'key1' });

      expect(result.isIdempotent).toBe(false);
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentStatus.PENDING, retryCount: 0 }));
      expect(useCase.processPayment).toHaveBeenCalledWith('123');
    });
  });

  describe('processPayment', () => {
    it('should fail if lock cannot be acquired', async () => {
      (LockService.acquireLock as jest.Mock).mockResolvedValueOnce(false);
      
      await expect(useCase.processPayment('123')).rejects.toThrow('Payment is already being processed');
    });

    it('should update status to SUCCESS on gateway success', async () => {
      const payment = { _id: '123', amount: 100, currency: 'USD', status: PaymentStatus.PENDING };
      mockRepo.findById.mockResolvedValue(payment as any);
      
      const gatewayResponse: PaymentGatewayResponse = { success: true, externalId: 'ext_123', message: 'OK' };
      mockGateway.process.mockResolvedValue(gatewayResponse);

      const updatedPayment = { ...payment, status: PaymentStatus.SUCCESS, externalId: 'ext_123' };
      mockRepo.updateStatus.mockImplementation(async (id, status, extId) => {
        if (status === PaymentStatus.SUCCESS) return updatedPayment as any;
        return null;
      });

      const result = await useCase.processPayment('123');

      expect(mockRepo.updateStatus).toHaveBeenCalledWith('123', PaymentStatus.PROCESSING);
      expect(mockGateway.process).toHaveBeenCalledWith(100, 'USD');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith('123', PaymentStatus.SUCCESS, 'ext_123');
      expect(result?.status).toBe(PaymentStatus.SUCCESS);
    });

    it('should update status to FAILED on gateway failure', async () => {
      const payment = { _id: '123', amount: 100, currency: 'USD', status: PaymentStatus.PENDING };
      mockRepo.findById.mockResolvedValue(payment as any);
      
      const gatewayResponse: PaymentGatewayResponse = { success: false, externalId: 'ext_123', message: 'Insufficient funds' };
      mockGateway.process.mockResolvedValue(gatewayResponse);

      const updatedPayment = { ...payment, status: PaymentStatus.FAILED };
      mockRepo.updateStatus.mockImplementation(async (id, status, extId, msg) => {
        if (status === PaymentStatus.FAILED) return updatedPayment as any;
        return null;
      });

      const result = await useCase.processPayment('123');

      expect(mockGateway.process).toHaveBeenCalledWith(100, 'USD');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith('123', PaymentStatus.FAILED, undefined, 'Insufficient funds');
      expect(result?.status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('handleWebhook', () => {
    it('should securely update payment status from webhook', async () => {
       const payment = { _id: '123', amount: 100, currency: 'USD', status: PaymentStatus.PENDING, externalId: 'ext_123' };
       mockRepo.findByExternalId.mockResolvedValue(payment as any);
       mockRepo.findById.mockResolvedValue(payment as any);

       await useCase.handleWebhook({ externalId: 'ext_123', status: 'SUCCESS', message: 'Webhook OK' });

       expect(mockRepo.updateStatus).toHaveBeenCalledWith('123', PaymentStatus.SUCCESS, undefined, 'Webhook OK');
    });

    it('should not downgrade status from SUCCESS to FAILED', async () => {
       const payment = { _id: '123', amount: 100, currency: 'USD', status: PaymentStatus.SUCCESS, externalId: 'ext_123' };
       mockRepo.findByExternalId.mockResolvedValue(payment as any);
       mockRepo.findById.mockResolvedValue(payment as any);

       await useCase.handleWebhook({ externalId: 'ext_123', status: 'FAILED', message: 'Late Decline' });

       expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    });
  });
});
