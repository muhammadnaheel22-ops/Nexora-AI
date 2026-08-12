import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmptyState from "../src/components/UI/EmptyState.jsx";

describe("EmptyState", () => {
  it("introduces the multi-agent workspace", () => {
    render(<EmptyState />);
    expect(screen.getByText(/multi-agent/i)).toBeInTheDocument();
  });
});
