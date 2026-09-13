export interface IntegrationSlice {
    mode: "demo" | "live";
    connected: boolean;
    targets: {
        tracker: string;
        messaging: string;
        mail: string;
    } | null;
}
export const initialIntegration = (): IntegrationSlice => ({ mode: "demo", connected: false, targets: null });
