/** Resolve the trusted billing customer independently of a free/internal plan's mode. */
type CustomerClient = {
  customers: {
    retrieve(id: string): Promise<{ deleted?: boolean; email?: string | null; livemode?: boolean }>;
  };
};
type Mode = "test" | "live";

export async function resolveBillingCustomer<T extends CustomerClient>(options: {
  preferredMode: Mode;
  customerId: string;
  email: string;
  keys: Record<Mode, string>;
  createClient: (key: string) => T;
}): Promise<T> {
  const modes: Mode[] = [options.preferredMode, options.preferredMode === "live" ? "test" : "live"];
  for (const mode of modes) {
    const key = options.keys[mode];
    if (!key) continue;
    const client = options.createClient(key);
    let customer;
    try {
      customer = await client.customers.retrieve(options.customerId);
    } catch (error) {
      // Only a missing customer permits checking the other configured environment.
      // Authentication, permission and network failures remain failures.
      if ((error as { code?: string }).code === "resource_missing") continue;
      throw error;
    }
    if (customer.deleted || customer.livemode !== (mode === "live") ||
      String(customer.email || "").trim().toLowerCase() !== options.email.trim().toLowerCase()) {
      throw new Error("Stripe billing customer does not match the authenticated account.");
    }
    return client;
  }
  throw new Error("The attached Stripe billing customer was not found in a configured environment.");
}
