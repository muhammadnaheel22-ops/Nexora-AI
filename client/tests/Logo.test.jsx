import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Logo from "../src/components/Logo.jsx";

describe("Logo", () => {
  it("identifies Nexora and the product category", () => {
    render(<Logo />);
    expect(screen.getByText("Nexora AI")).toBeInTheDocument();
    expect(screen.getByText(/multi-agent workspace/i)).toBeInTheDocument();
  });
});
