import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Logo from "../src/components/UI/Logo.jsx";

describe("Logo", () => {
  it("renders Nexora branding", () => {
    render(<Logo />);
    expect(screen.getByText("Nexora AI")).toBeInTheDocument();
    expect(screen.getByText("Multi-agent studio")).toBeInTheDocument();
  });
});
