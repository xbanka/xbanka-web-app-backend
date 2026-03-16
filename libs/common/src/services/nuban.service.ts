import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ObiexService } from '../integrations/obiex.service';

@Injectable()
export class NubanService implements OnModuleInit {
    private readonly logger = new Logger(NubanService.name);
    private readonly weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];
    private banks: { name: string; code: string }[] = [];

    constructor(private readonly obiex: ObiexService) { }

    async onModuleInit() {
        await this.refreshBanks();
    }

    /**
     * Refreshes the in-memory bank list from Obiex.
     */
    async refreshBanks() {
        try {
            this.logger.log('🔄 Refreshing Nigerian bank list from Obiex...');
            const response: any = await this.obiex.getNgnBanks();
            const fetchedBanks = response?.data || response;

            if (Array.isArray(fetchedBanks)) {
                this.banks = fetchedBanks.map((bank: any) => ({
                    name: bank.name,
                    code: bank.code,
                }));
                this.logger.log(`✅ Successfully loaded ${this.banks.length} banks.`);
            } else {
                this.logger.warn('⚠️ Obiex returned invalid bank data — using previous list');
            }
        } catch (error) {
            this.logger.error(`❌ Failed to refresh banks: ${error.message}`);
        }
    }

    /**
     * Calculates the check digit for a given bank code and serial number.
     * @param bankCode 3-digit bank code
     * @param serialNumber 9-digit account serial number
     */
    calculateCheckDigit(bankCode: string, serialNumber: string): number {
        // Ensure bankCode is 3 digits and serialNumber is 9 digits (left padded with zeros)
        const paddedBankCode = bankCode.padStart(3, '0').slice(-3);
        const paddedSerial = serialNumber.padStart(9, '0').slice(-9);

        const combined = paddedBankCode + paddedSerial;
        const digits = combined.split('').map(Number);

        const sum = digits.reduce((acc, digit, i) => acc + digit * this.weights[i], 0);

        let checkDigit = 10 - (sum % 10);
        if (checkDigit === 10) checkDigit = 0;

        return checkDigit;
    }

    /**
     * Validates a 10-digit NUBAN for a specific bank code.
     */
    validate(accountNumber: string, bankCode: string): boolean {
        if (accountNumber.length !== 10) return false;

        const serialNumber = accountNumber.substring(0, 9);
        const providedCheckDigit = Number(accountNumber.substring(9, 10));
        const calculatedCheckDigit = this.calculateCheckDigit(bankCode, serialNumber);

        return providedCheckDigit === calculatedCheckDigit;
    }

    /**
     * Identifies potential banks for a given 10-digit account number.
     */
    getBanksForAccount(accountNumber: string) {
        if (accountNumber.length !== 10) return [];

        return this.banks.filter((bank) => this.validate(accountNumber, bank.code));
    }

    /**
     * Generates a full 10-digit NUBAN from a serial number and bank code.
     */
    generateNuban(serialNumber: string, bankCode: string): string {
        const paddedSerial = serialNumber.padStart(9, '0').slice(-9);
        const checkDigit = this.calculateCheckDigit(bankCode, paddedSerial);
        return paddedSerial + checkDigit;
    }

    /**
     * Returns the full list of supported banks.
     */
    getBanks() {
        return this.banks;
    }
}
