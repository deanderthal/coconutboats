export type EngineServiceHours = {
  service_hours: number | null | undefined;
  service_interval_hours: number | null | undefined;
};

export const DEFAULT_ENGINE_SERVICE_INTERVAL_HOURS = 90;

export function engineServiceInterval(engine: EngineServiceHours) {
  const interval = Number(engine.service_interval_hours);
  return interval > 0 ? interval : DEFAULT_ENGINE_SERVICE_INTERVAL_HOURS;
}

export function isEngineServiceDue(engine: EngineServiceHours) {
  return Number(engine.service_hours ?? 0) >= engineServiceInterval(engine);
}

export function summarizeEngineServiceDue(engines: EngineServiceHours[]) {
  return engines.reduce((count, engine) => count + (isEngineServiceDue(engine) ? 1 : 0), 0);
}
