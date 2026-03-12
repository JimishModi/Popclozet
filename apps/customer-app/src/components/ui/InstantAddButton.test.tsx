// src/components/ui/InstantAddButton.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InstantAddButton from "./InstantAddButton";

// Mock the FlyToCart context
vi.mock("@/context/FlyToCartContext", () => ({
  useFlyToCart: () => ({ triggerFlyAnimation: vi.fn() }),
}));

describe("InstantAddButton", () => {
  const mockOnAdd = vi.fn();
  const mockOnIncrement = vi.fn();
  const mockOnDecrement = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Add" button when quantity is 0', () => {
    render(
      <InstantAddButton
        quantity={0}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
      />
    );

    // Add button should be present
    expect(screen.getByRole("button", { name: /add/i })).toBeTruthy();
  });

  it("renders counter when quantity is > 0", () => {
    render(
      <InstantAddButton
        quantity={1}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
      />
    );

    // The numeric counter should be visible
    expect(screen.getByText("1")).toBeTruthy();
  });

  it('calls onAdd when "Add" is clicked', () => {
    render(
      <InstantAddButton
        quantity={0}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
      />
    );

    const addBtn = screen.getByRole("button", { name: /add/i });
    fireEvent.click(addBtn);
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onIncrement when "+" is clicked', () => {
    render(
      <InstantAddButton
        quantity={1}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
      />
    );

    const increaseBtn = screen.getByLabelText("Increase quantity");
    fireEvent.click(increaseBtn);
    expect(mockOnIncrement).toHaveBeenCalledTimes(1);
  });

  it('calls onDecrement when "-" is clicked', () => {
    render(
      <InstantAddButton
        quantity={2}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
      />
    );

    const decreaseBtn = screen.getByLabelText("Decrease quantity");
    fireEvent.click(decreaseBtn);
    expect(mockOnDecrement).toHaveBeenCalledTimes(1);
  });
});
