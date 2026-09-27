import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { setI18n } from "react-i18next";
import { createI18n } from "@/i18n/instance";

// vitest globals are off, so Testing Library can't register its own cleanup.
afterEach(cleanup);

// Components rendered without an <I18nextProvider> translate in English (the app itself always
// provides a per-request instance from __root.tsx). Tests that care about the locale wrap in a provider.
setI18n(createI18n("en"));
