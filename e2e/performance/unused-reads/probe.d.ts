declare module "probe:baseline" {
  const Component: import("react").ComponentType<{ sectionId: string; eventId?: string; onBack: () => void }>;
  export default Component;
}
declare module "probe:candidate" {
  const Component: import("react").ComponentType<{ sectionId: string; eventId?: string; onBack: () => void }>;
  export default Component;
}
