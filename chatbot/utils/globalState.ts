export let botDisabled = false;

export const setBotDisabled = (value: boolean) => {
  botDisabled = value;
};

export const adminDisabledUsers = new Set<string>();

// Configure admin phone numbers here (without country code if needed, but match ctx.from format)
export const adminPhones = new Set<string>([
  // Add admin phone numbers, e.g., '1234567890'
  // For security, consider using environment variables
  process.env.PHONE_ADMIN
]);