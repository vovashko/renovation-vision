// Typed translation keys: `t("common:status.done")` and `useTranslation("work")` autocomplete and
// typecheck against the English JSON. One line per namespace; every feature is pre-registered, so a
// feature task only edits its own `src/features/<feature>/i18n/{en,pl}.json`.
// (tests/unit/i18n/parity.test.ts fails if a namespace on disk is missing here.)
import "i18next";
import type common from "./common/en.json";
import type admin from "../features/admin/i18n/en.json";
import type auth from "../features/auth/i18n/en.json";
import type budget from "../features/budget/i18n/en.json";
import type comms from "../features/comms/i18n/en.json";
import type importNs from "../features/import/i18n/en.json";
import type knowledge from "../features/knowledge/i18n/en.json";
import type media from "../features/media/i18n/en.json";
import type people from "../features/people/i18n/en.json";
import type projects from "../features/projects/i18n/en.json";
import type settings from "../features/settings/i18n/en.json";
import type work from "../features/work/i18n/en.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    returnNull: false;
    resources: {
      common: typeof common;
      admin: typeof admin;
      auth: typeof auth;
      budget: typeof budget;
      comms: typeof comms;
      import: typeof importNs;
      knowledge: typeof knowledge;
      media: typeof media;
      people: typeof people;
      projects: typeof projects;
      settings: typeof settings;
      work: typeof work;
    };
  }
}
