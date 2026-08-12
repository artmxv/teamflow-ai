import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLegalDocument, LEGAL_CONTACT_EMAIL } from "./legal-documents.js";

describe("legal documents", () => {
  for (const lang of ["en", "ru"] as const) {
    it(`provides complete ${lang.toUpperCase()} public documents`, () => {
      const privacy = getLegalDocument(lang, "privacy");
      const consent = getLegalDocument(lang, "consent");
      const terms = getLegalDocument(lang, "terms");

      assert.equal(privacy.sections.length, 13);
      assert.equal(consent.sections.length, 7);
      assert.equal(terms.sections.length, 15);
      assert.match(privacy.updated, /2026/);
      assert.match(consent.updated, /2026/);
      assert.match(terms.updated, /2026/);

      const allText = JSON.stringify({ privacy, consent, terms });
      assert.match(allText, new RegExp(LEGAL_CONTACT_EMAIL));
      assert.doesNotMatch(allText, /ИНН|ОГРН|LLC|Ltd\.|Inc\./);
    });
  }
});
