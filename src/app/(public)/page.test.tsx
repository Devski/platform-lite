import { describe, expect, it } from "vitest";
import { isValidElement, type ReactNode } from "react";
import HomePage from "./page";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
}

describe("HomePage", () => {
  it("renders the platform-lite placeholder heading", () => {
    expect(textOf(HomePage())).toContain("platform-lite");
  });
});
