import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PATTERNS, code128Codes, code128Modules } from "@/lib/barcode/code128";

const require = createRequire(import.meta.url);
const JsBarcode = require("jsbarcode");

function reference(text: string): string {
  const out: { encodings?: { data: string }[] } = {};
  JsBarcode(out, text, { format: "CODE128B" });
  return (out.encodings ?? []).map((e) => e.data).join("");
}

describe("Code 128 encoder", () => {
  it("has 107 patterns whose widths sum to 11 modules (stop = 13)", () => {
    expect(PATTERNS).toHaveLength(107);
    PATTERNS.forEach((p, i) => {
      const sum = p.split("").reduce((n, d) => n + Number(d), 0);
      expect(sum, `pattern ${i}`).toBe(i === 106 ? 13 : 11);
    });
  });

  it("matches jsbarcode for representative strings", () => {
    const samples = [
      "TH000001000",
      "SPXTH000003000",
      "EP000004000TH",
      "LOC:A-01-02-1-03",
      "ORD:ord-0014",
      "TOT:tot-0001",
      "8850000000012",
      "Hello World ~ {}",
      "",
    ];
    for (const t of samples) {
      if (!t) continue;
      expect(code128Modules(t), t).toBe(reference(t));
    }
  });

  it("checksum code is in range", () => {
    const codes = code128Codes("TH000001000");
    expect(codes[0]).toBe(104);
    expect(codes.at(-1)).toBe(106);
    expect(codes.at(-2)!).toBeLessThan(103);
  });
});
