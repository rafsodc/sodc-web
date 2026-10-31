declare module "probe:baseline" {
  const Component: import("react").ComponentType<{ sectionId: string; eventId?: string; onBack: () => void }>;
  export default Component;
}
declare module "probe:candidate" {
  const Component: import("react").ComponentType<{ sectionId: string; eventId?: string; onBack: () => void }>;
  export default Component;
}
declare module "probe:home-baseline" {
  export function useUpcomingEventsForUser(sections: Array<{ id: string; type: "EVENTS"; name: string }>): { events: unknown[]; loading: boolean; isError: boolean };
}
declare module "probe:home-candidate" {
  export function useUpcomingEventsForUser(sections: Array<{ id: string; type: "EVENTS"; name: string }>): { events: unknown[]; loading: boolean; isError: boolean };
}
