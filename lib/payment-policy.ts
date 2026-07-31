export const PaymentPolicy = {
	PAY_BEFORE_SERVICE: "PAY_BEFORE_SERVICE",
	PAY_AFTER_SERVICE: "PAY_AFTER_SERVICE",
	FLEXIBLE: "FLEXIBLE",
} as const;

export type PaymentPolicy = (typeof PaymentPolicy)[keyof typeof PaymentPolicy];
