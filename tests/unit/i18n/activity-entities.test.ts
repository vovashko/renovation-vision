import { describe, it, expect } from "vitest";
import { ACTIVITY_ENTITIES } from "@/features/comms/domain/params";
import commEnResources from "@/features/comms/i18n/en.json";
import commPlResources from "@/features/comms/i18n/pl.json";

describe("activity entity i18n", () => {
  it("has a label for every ACTIVITY_ENTITIES value in comms en.json", () => {
    const entityLabels = commEnResources.activity.entity as Record<string, string>;
    for (const entity of ACTIVITY_ENTITIES) {
      expect(entityLabels[entity], `missing comms:activity.entity.${entity} in en.json`).toBeDefined();
      expect(entityLabels[entity]).toBeTruthy();
    }
  });

  it("has a label for every ACTIVITY_ENTITIES value in comms pl.json", () => {
    const entityLabels = commPlResources.activity.entity as Record<string, string>;
    for (const entity of ACTIVITY_ENTITIES) {
      expect(entityLabels[entity], `missing comms:activity.entity.${entity} in pl.json`).toBeDefined();
      expect(entityLabels[entity]).toBeTruthy();
    }
  });

  it("has matching keys between en and pl for all activity entities", () => {
    const enKeys = Object.keys(commEnResources.activity.entity as Record<string, string>).sort();
    const plKeys = Object.keys(commPlResources.activity.entity as Record<string, string>).sort();
    expect(plKeys).toEqual(enKeys);
  });
});
